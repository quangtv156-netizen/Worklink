# WorkLink Production Runbook & Operations Guide

Tài liệu hướng dẫn vận hành, xử lý sự cố (Incident Response), sao lưu dự phòng và quy trình bảo mật cho hệ thống WorkLink trên Production.

---

## 1. Giám sát & Kiểm tra Trạng thái Hệ thống (Health Check)

Hệ thống cung cấp endpoint giám sát chi tiết tại: `GET /api/health`

### Phản hồi mẫu khi hệ thống bình thường (HTTP 200):
```json
{
  "status": "online",
  "database": "connected",
  "dbLatencyMs": 4,
  "storage": {
    "uploads": "writable"
  },
  "system": {
    "uptimeSeconds": 86400,
    "memoryRssMb": 92,
    "nodeVersion": "v20.x"
  },
  "platform": "WorkLink API Server"
}
```

### Xử lý khi trạng thái `degraded` hoặc HTTP 503:
- **`database: "disconnected"`**: 
  1. Kiểm tra container Postgres: `docker ps | grep postgres` hoặc service Postgres cục bộ.
  2. Kiểm tra log kết nối: Xem `DATABASE_URL` trong biến môi trường hoặc connection pool exhaustion.
  3. Khởi động lại CSDL: `docker-compose restart postgres`
- **`storage.uploads: "readonly_or_unavailable"`**:
  1. Kiểm tra quyền ghi thư mục `uploads/`: `chmod -R 755 uploads` (hoặc kiểm tra ổ đĩa đầy qua `df -h`).
  2. Dọn dẹp thư mục tạm `tmp/` nếu dung lượng đĩa quá tải.

---

## 2. Quy trình Sao lưu & Phục hồi CSDL (Backup & Restore)

### Sao lưu CSDL (Hàng ngày / Trước khi nâng cấp)
Hệ thống có script tự động sao lưu cấu trúc và dữ liệu thành file `.sql.gz` có gắn timestamp:
```bash
npm run db:backup
```
*File sao lưu được lưu tại thư mục `backups/backup_worklink_YYYY-MM-DD_HHmmss.sql.gz`.*

### Khôi phục CSDL từ bản sao lưu
```bash
npm run db:restore -- backups/backup_worklink_YYYY-MM-DD_HHmmss.sql.gz
```

### Đặt lịch tự động (Cronjob Linux)
Thêm vào crontab (`crontab -e`) để tự động sao lưu mỗi đêm lúc 02:00 sáng:
```cron
0 2 * * * cd /opt/worklink && /usr/bin/npm run db:backup >> /var/log/worklink-backup.log 2>&1
```

---

## 3. Quản lý Di chuyển CSDL (Database Migrations)

Các migration phiên bản được lưu tại `database/migrations/*.sql`. Khi deploy phiên bản mới:
```bash
npm run db:migrate
```
Script sẽ kiểm tra bảng `schema_migrations`, áp dụng tuần tự các migration chưa chạy bên trong transaction `BEGIN ... COMMIT` an toàn.

---

## 4. Xoay vòng Khóa Bí mật & Thu hồi Session (Key Rotation & Session Revocation)

### Tạo khóa JWT_SECRET mới ngẫu nhiên và an toàn:
```bash
npm run secret:generate
```
Cập nhật biến `JWT_SECRET` trong `.env` của server.

### Thu hồi Token của 1 người dùng nghi ngờ bị lộ (Immediate Revocation):
Hệ thống sử dụng cơ chế `token_version`. Để vô hiệu hóa ngay lập tức toàn bộ access token và refresh token của user mà không cần restart server:
```sql
UPDATE users SET token_version = token_version + 1 WHERE email = 'user-bi-lo@example.com';
```
Ngay lập tức, middleware `authenticateToken` sẽ từ chối token cũ với mã lỗi `401 TOKEN_REVOKED`.

---

## 5. Xử lý Sự cố Tấn công & Giới hạn Tần suất (Rate Limiting)

Hệ thống áp dụng 3 tầng rate limiter:
- **General Limiter**: 120 req/phút cho các API thông thường.
- **Auth Limiter**: 10 req/15 phút cho `/api/auth/login`, `/api/auth/register`.
- **AI Limiter**: 10 req/phút cho `/api/ai/optimize-cv`, `/api/cv/analyze`.

Nếu phát hiện IP cố tình spam hoặc tấn công DoS:
1. Kiểm tra log audit: `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;`
2. Chặn IP tại cấp WAF (Cloudflare) hoặc Nginx:
   ```nginx
   deny 203.0.113.195;
   ```

---

## 6. Bảo vệ Quyền riêng tư & Tuân thủ GDPR

- **Xuất dữ liệu người dùng (Data Portability)**: Người dùng có thể yêu cầu tải toàn bộ dữ liệu qua endpoint `GET /api/auth/me/export`.
- **Xóa vĩnh viễn tài khoản (Right to be Forgotten)**: Người dùng tự xóa tài khoản tại `DELETE /api/auth/me`. Toàn bộ hồ sơ ứng tuyển, tin nhắn, CV liên quan sẽ được xóa sạch hoặc ẩn danh theo quy định.

---

## 7. Khởi động lại Khẩn cấp (Graceful Restart)

```bash
# Docker Compose
docker-compose down && docker-compose up -d --build

# Systemd (nếu chạy dạng service)
sudo systemctl restart worklink-api
```
