# 🚀 Hướng dẫn Triển khai Hệ thống WorkLink lên Môi trường Production

Tài liệu này cung cấp hướng dẫn chi tiết từ A-Z để triển khai toàn bộ ứng dụng **WorkLink** (Frontend React 19 + Vite và Backend Node.js Express + Socket.io + PostgreSQL CSDL) lên môi trường production trên các nền tảng đám mây phổ biến (**Render, Railway, Neon, Vercel, hoặc Docker Compose**).

> 💡 **File Mẫu Cấu Hình Production:** Dự án đã chuẩn bị sẵn file [.env.production.example](file:///d:/Download/MInh/.env.production.example) với đầy đủ các tham số và giá trị mẫu chuẩn mực. Bạn có thể tham khảo hoặc sao chép file này làm mẫu khi cấu hình biến môi trường trên Render, Railway, Docker hoặc VPS.

---

## 📋 1. Danh sách Biến Môi trường Đầy đủ (.env)

Hệ thống sử dụng các biến môi trường sau để đảm bảo an ninh và tính linh hoạt khi triển khai:

| Biến môi trường | Bắt buộc | Mặc định (nếu không đặt) | Ý nghĩa & Hướng dẫn |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Có | `development` | Đặt `production` khi deploy. |
| `PORT` | Không | `5000` | Cổng máy chủ Backend lắng nghe. |
| `POSTGRES_PASSWORD` | **BẮT BUỘC (Prod/Docker)** | *(Không có default)* | Mật khẩu tài khoản `postgres` CSDL. Bắt buộc cấu hình chuỗi mạnh (tránh dùng `postgres`). |
| `DATABASE_URL` | **BẮT BUỘC** | `postgresql://postgres:postgres@localhost:5432/worklink` | Chuỗi kết nối PostgreSQL (Neon, Render Postgres, Railway, Supabase). |
| `DATABASE_SSL` | Tùy chọn | `false` | Đặt `true` nếu dịch vụ Cloud Database yêu cầu chứng chỉ SSL (ví dụ Neon / Supabase). |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Tùy chọn | `true` (khi SSL bật) | Xác thực chứng chỉ SSL máy chủ DB. Mặc định `true` an toàn; đặt `false` nếu dùng self-signed cert nội bộ. |
| `DATABASE_CA_CERT_PATH` | Tùy chọn | *(Trống)* | Đường dẫn file chứng chỉ CA (.pem/.crt) nếu kết nối DB qua CA riêng. |
| `CV_UPLOAD_DIR` | Tùy chọn | `./uploads/cv` | Thư mục lưu trữ bền vững các file CV ứng viên đã tải lên. |
| `VITE_API_URL` | Có (Frontend) | `http://localhost:5000` | URL Backend thật để Frontend gọi API (không có dấu `/` ở cuối). |
| `ALLOWED_ORIGINS` | **BẮT BUỘC (Prod)** | `http://localhost:5173,...` | **CỰC KỲ QUAN TRỌNG:** Danh sách domain Frontend được phép truy cập API (phân cách bằng dấu phẩy). <br>Ví dụ: `https://worklink.vercel.app,https://mycustomdomain.com`<br>*(Nếu thiếu biến này trên Production, CORS sẽ chặn sạch mọi request từ Frontend thật).* |
| `ENABLE_CSP` | Tùy chọn | `true` (trên Prod) | Kích hoạt bộ Content Security Policy bảo vệ XSS toàn diện. |
| `JWT_SECRET` | **BẮT BUỘC (Prod)** | Khóa mặc định dev | Khóa bí mật ký JWT Token 256-bit (>= 32 ký tự). <br>Tạo nhanh: `npm run secret:generate`. |
| `BCRYPT_ROUNDS` | Không | `12` | Số vòng băm mật khẩu Bcrypt. |
| `SEED_DEFAULT_PASSWORD` | Không | `123456` | Mật khẩu mẫu khởi tạo cho các tài khoản seed trên DB mới (nên đổi khỏi `123456` trên production). |
| `ADMIN_INITIAL_PASSWORD` | Không | `123456` | Mật khẩu tài khoản quản trị `admin@worklink.vn` khi khởi tạo DB lần đầu. |
| `SMTP_HOST` | Tùy chọn | *(Trống)* | Địa chỉ máy chủ gửi email (ví dụ: `smtp.gmail.com`, `smtp.sendgrid.net`). |
| `SMTP_PORT` | Tùy chọn | `587` | Cổng SMTP (587 cho STARTTLS, 465 cho SSL). |
| `SMTP_SECURE` | Tùy chọn | `false` | Đặt `true` nếu dùng port 465 SSL. |
| `SMTP_USER` | Tùy chọn | *(Trống)* | Tài khoản email gửi thư (ví dụ: `your_email@gmail.com`). |
| `SMTP_PASS` | Tùy chọn | *(Trống)* | Mật khẩu ứng dụng (App Password) của tài khoản email. |
| `EMAIL_FROM` | Tùy chọn | `WorkLink Security <...>` | Tên và địa chỉ người gửi hiển thị trong hộp thư người nhận. |
| `GEMINI_API_KEY` | Tùy chọn | *(Trống)* | Google Gemini API Key để kích hoạt tính năng AI Copilot & CV Analyzer phía Server. |
| `GEMINI_MODEL` | Không | `gemini-2.0-flash` | Model Gemini sử dụng (khuyên dùng `gemini-2.0-flash`). |

> 🔑 **Tạo Cấu Hình Môi Trường 1 Bước:** Bạn có thể chạy lệnh:
> ```bash
> npm run secret:generate -- --write
> ```
> Lệnh này sẽ tự động sinh ngẫu nhiên `JWT_SECRET` (256-bit hex), `POSTGRES_PASSWORD` mạnh, `ADMIN_INITIAL_PASSWORD`, và tạo file `.env` chuẩn chỉnh cho Production.

> 🔒 **Cơ chế Reverse Proxy & Rate Limiting:** Backend đã kích hoạt sẵn `app.set('trust proxy', 1)` trong `server/index.js`. Do đó, khi triển khai sau reverse proxy của **Render, Railway, Vercel hoặc Nginx**, `express-rate-limit` sẽ nhận diện chính xác IP của người dùng thực thông qua header `X-Forwarded-For` mà không bị xung đột IP chung hay lỗi `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

---

## 🔑 2. Hướng xử lý tính năng "Quên mật khẩu" khi Deploy

Tính năng "Quên mật khẩu" (`/api/auth/forgot-password`) hoạt động theo 2 chế độ thông minh:

1. **Chế độ Production Thật (Khuyên dùng khi đưa vào sử dụng thực tế):**
   - Điền đầy đủ các biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` vào Dashboard dịch vụ deploy.
   - Hệ thống sẽ tự động sử dụng `nodemailer` để gửi email thật chứa mã xác thực đặt lại mật khẩu về hộp thư của người dùng.
2. **Chế độ Demo / Đồ án (Mặc định khi chưa có SMTP):**
   - Nếu không có cấu hình SMTP, hệ thống sẽ tự động chuyển sang mô phỏng: mã xác thực chỉ được ghi ra server console và lưu vào bảng nội bộ `password_resets`.
   - Phản hồi HTTP trả về client luôn là thông báo chung đồng nhất (`HTTP 200`), bảo đảm tuyệt đối không làm lộ token ra ngoài và không rò rỉ email đã đăng ký (chống Email Enumeration & Account Takeover).

---

## 🌐 3. Mô hình 1: Triển khai Tách rời (Frontend Vercel + Backend & PostgreSQL Render/Neon)

Đây là mô hình tiêu chuẩn, dễ mở rộng và có gói miễn phí/giá rẻ rất phù hợp.

### Bước 3.1: Tạo Cơ sở dữ liệu PostgreSQL (Neon.tech hoặc Render Postgres)
1. Đăng ký tài khoản miễn phí tại [Neon.tech](https://neon.tech) hoặc tạo PostgreSQL trên Render.
2. Lấy chuỗi kết nối `DATABASE_URL` (ví dụ: `postgresql://neondb_owner:***@ep-cool-fog-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`).
3. Hệ thống sẽ tự động đọc `schema.sql` và seed dữ liệu khởi tạo khi backend kết nối lần đầu!

### Bước 3.2: Triển khai Backend lên Render.com (Web Service)
1. Đăng nhập [Render.com](https://render.com) -> Chọn **New** -> **Web Service**.
2. Kết nối tới GitHub repository của bạn.
3. Cấu hình thông số:
   - **Name**: `worklink-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
4. **Environment Variables**:
   ```ini
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
   DATABASE_SSL=true
   JWT_SECRET=<chạy "npm run secret:generate" để lấy chuỗi 64 ký tự hex>
   ALLOWED_ORIGINS=https://ten-ung-dung-cua-ban.vercel.app
   SEED_DEFAULT_PASSWORD=MatKhauKhoiTaoMoi2026!
   ADMIN_INITIAL_PASSWORD=AdminMatKhauBaoMat2026!
   # Nếu có SMTP:
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   # Nếu có Gemini:
   GEMINI_API_KEY=AIzaSy...
   ```
5. **Thêm Persistent Disk (bắt buộc để CV ứng viên không bị mất khi redeploy):**
   - Ổ đĩa mặc định của Render Web Service là ephemeral (dữ liệu tải lên sẽ bị xóa sạch sau mỗi lần restart hoặc redeploy). Để lưu trữ bền vững các file CV ứng viên:
   - Vào tab **"Disks"** của Web Service vừa tạo -> bấm **"Add Disk"**.
   - **Mount Path**: Khớp đúng giá trị biến `CV_UPLOAD_DIR` đang cấu hình (ví dụ: `/opt/render/project/src/uploads/cv` nếu dùng giá trị mặc định).
   - **Size**: `1 GB` là đủ cho giai đoạn đầu, có thể tăng dung lượng sau khi cần.
6. Bấm **Create Web Service**. Lưu lại URL Backend (ví dụ: `https://worklink-api.onrender.com`).

### Bước 3.3: Triển khai Frontend lên Vercel
1. Đăng nhập [Vercel](https://vercel.com) -> Chọn **Add New Project** -> Chọn GitHub repo của WorkLink.
2. Cấu hình Build:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. Cấu hình **Environment Variables**:
   - `VITE_API_URL`: Điền URL Backend từ Render (ví dụ: `https://worklink-api.onrender.com`).
4. Bấm **Deploy**.
5. Sau khi có domain Vercel (ví dụ: `https://worklink-abc.vercel.app`), hãy quay lại Render cập nhật biến `ALLOWED_ORIGINS` cho khớp chính xác!

---

## 🐳 4. Mô hình 2: Khởi chạy Trọn gói 1 Lệnh với Docker Compose

WorkLink cung cấp sẵn file `docker-compose.yml` gồm 2 dịch vụ độc lập:
1. `postgres`: PostgreSQL 16 Alpine với healthcheck tự động và persistent volume.
2. `app`: Fullstack WorkLink (Frontend build dist + Backend Express + Socket.io).

### Khởi chạy cực nhanh:
```bash
docker compose up -d --build
```

Kiểm tra trạng thái các container:
```bash
docker compose ps
```

Truy cập ngay ứng dụng tại: `http://localhost:5000`.

Dừng dịch vụ:
```bash
docker compose down
```

---

## ⚡ 5. Tài liệu API Phân Trang (Pagination) cho Production

Tất cả các endpoint danh sách chính đều hỗ trợ phân trang chuẩn RESTful, giúp tối ưu băng thông và tải trang nhanh khi dữ liệu tăng trưởng lớn:

| Endpoint | Tham số phân trang | Ví dụ gọi | Cấu trúc phản hồi |
|:---|:---|:---|:---|
| `GET /api/jobs` | `page` (mặc định 1), `limit` (1–100, mặc định 20) | `/api/jobs?page=1&limit=20` | `{ success: true, count, total, pagination: { page, limit, totalPages, total, hasNext, hasPrev }, jobs: [...] }` |
| `GET /api/freelance` | `page`, `limit`, `status`, `category` | `/api/freelance?page=1&limit=15` | `{ success: true, count, total, pagination: { ... }, projects: [...] }` |
| `GET /api/gigs` | `page`, `limit`, `status`, `employer_id` | `/api/gigs?page=1&limit=20` | `{ success: true, count, total, pagination: { ... }, gigs: [...] }` |

*(Lưu ý: Nếu client không truyền `page` hay `limit`, API sẽ trả về toàn bộ dữ liệu kèm trường `total` để tương thích 100% với giao diện hiện tại).*

---

## 🔍 6. Kiểm tra & Giám sát Sau Triển khai (Smoke Tests)

Sau khi deploy thành công, thực hiện kiểm tra nhanh theo thứ tự:

1. **Kiểm tra Healthcheck Endpoint:**
   ```bash
   curl -i https://your-backend-domain.com/api/health
   ```
   **Phản hồi chuẩn (HTTP 200):**
   ```json
   {
     "status": "online",
     "platform": "WorkLink API Server",
     "version": "2.0.0",
     "realtime": "Socket.io enabled",
     "timestamp": "2026-09-26T..."
   }
   ```

2. **Kiểm tra CORS Header:**
   ```bash
   curl -I -H "Origin: https://your-frontend-domain.com" https://your-backend-domain.com/api/health
   # Phải có header: Access-Control-Allow-Origin: https://your-frontend-domain.com
   ```

3. **Kiểm tra Chức năng Trên Giao diện:**
   - [x] Đăng ký / Đăng nhập tài khoản mới (Xác thực HttpOnly Cookie bảo vệ chống XSS).
   - [x] Thử tính năng "Quên mật khẩu" -> Kiểm tra nhận email hoặc log server.
   - [x] Tìm kiếm việc làm bằng AI Natural Language.
   - [x] Nộp hồ sơ và ứng tuyển thử một tin tuyển dụng; tải thử file CV của ứng viên.
   - [x] Chat Real-time qua Socket.io giữa NTD và Ứng viên.
   - [x] Bản đồ Gig việc vặt & Phân hệ Freelancer.

---

## 📡 7. Chiến Lược Giám Sát Lỗi & Tracing (Observability & Sentry)

Hệ thống WorkLink tích hợp kiến trúc **Centralized Observability** chuẩn Production từ frontend tới backend:

### 7.1. Cấu hình Sentry (Tùy chọn)
Thêm DSN vào biến môi trường máy chủ:
- **Backend (Render / Container):**
  ```env
  SENTRY_DSN=https://your_public_key@o000000.ingest.sentry.io/1234567
  ```
- **Frontend (Vite / Vercel / Netlify):**
  ```env
  VITE_SENTRY_DSN=https://your_public_key@o000000.ingest.sentry.io/1234567
  ```

### 7.2. Tính năng Observability Tích Hợp Sẵn:
1. **Zero-Dependency Sentry Ingest:** Sử dụng HTTP REST API trực tiếp của Sentry, không làm nặng bundle hay xung đột dependencies.
2. **Contextual Tracing:** Mỗi HTTP request được cấp một mã `X-Request-Id` duy nhất, truyền xuyên suốt qua header và response để dễ dàng tra cứu log.
3. **Latency & Slow Request Alert:** Tự động cảnh báo các truy vấn chậm (> 1000ms) và các lỗi 5xx.
4. **Structured JSON Logs:** Khi `NODE_ENV=production`, log lỗi được format chuẩn JSON tương thích ngay lập tức với Datadog, Render Logs, Google Cloud Logging, AWS CloudWatch.
5. **React ErrorBoundary:** Bắt toàn bộ lỗi giao diện, tránh hiện màn hình trắng, tự động gửi crash report và cung cấp nút thử lại cho người dùng.

---

## 💾 8. Chiến Lược Sao Lưu & Khôi Phục Dữ Liệu (Backup & Disaster Recovery)

### 8.1. Thực hiện Sao lưu (Database Backup)
WorkLink cung cấp script sao lưu tự động trích xuất cấu trúc và dữ liệu của tất cả các bảng:
```bash
npm run db:backup
```
- **Vị trí lưu trữ:** Thư mục `backups/worklink_backup_YYYYMMDD_HHMMSS.sql`.
- **Chính sách lưu trữ (Retention Policy):** Tự động dọn dẹp các bản sao lưu cũ hơn **7 ngày** để tránh tràn ổ đĩa.
- **Tính độc lập:** Script tự động đọc `DATABASE_URL` và sử dụng driver Postgres thuần, chạy được trên mọi môi trường mà không bắt buộc cài tiện ích `pg_dump` ngoài hệ điều hành.

### 8.2. Khôi phục Dữ liệu (Database Restore)
Khi cần khôi phục lại dữ liệu sau sự cố hoặc rollback môi trường:
```bash
# Tự động chọn và khôi phục từ bản sao lưu mới nhất trong thư mục backups/
npm run db:restore

# Hoặc chỉ định một file cụ thể:
node scripts/restore-db.js backups/worklink_backup_20261004_120000.sql
```

### 8.3. Thiết lập Tự động Hàng Ngày (Automated Cron Job)
Trên Linux/macOS hoặc máy chủ VPS, cấu hình crontab chạy vào 02:00 sáng mỗi ngày:
```bash
0 2 * * * cd /path/to/worklink && npm run db:backup >> /var/log/worklink_backup.log 2>&1
```
