# 🚀 WorkLink — Nền tảng Kết nối Việc làm Bán thời gian & Freelance cho Sinh viên

> **Đồ án Full-stack Web Application**: Nền tảng tuyển dụng thông minh tích hợp AI Matchmaking, Bản đồ việc vặt tương tác (Leaflet), Chợ chào thầu Freelance và Trò chuyện thời gian thực (Socket.io).

---

## 📌 Mục lục
1. [Giới thiệu tổng quan](#-giới-thiệu-tổng-quan)
2. [Kiến trúc & Công nghệ sử dụng](#-kiến-trúc--công-nghệ-sử-dụng)
3. [Các tính năng nổi bật](#-các-tính-năng-nổi-bật)
4. [Tài khoản Demo thử nghiệm](#-tài-khoản-demo-thử-nghiệm)
5. [Hướng dẫn cài đặt & Chạy ứng dụng](#-hướng-dẫn-cài-đặt--chạy-ứng-dụng)
6. [Cấu hình biến môi trường (.env)](#-cấu-hình-biến-môi-trường-env)
7. [Hệ thống Kiểm thử Tự động (Automated Tests)](#-hệ-thống-kiểm-thử-tự-động-automated-tests)
8. [Hướng dẫn Đóng gói Nộp bài Chuẩn](#-hướng-dẫn-đóng-gói-nộp-bài-chuẩn)
9. [Hướng dẫn Triển khai Production & Docker](#-hướng-dẫn-triển-khai-production--docker)

---

## 📖 Giới thiệu tổng quan

**WorkLink** giải quyết khoảng trống giữa sinh viên tìm kiếm việc làm bán thời gian/linh hoạt và các nhà tuyển dụng (quán cafe, agency, cửa hàng, doanh nghiệp vừa và nhỏ). 

Hệ thống cung cấp trải nghiệm tìm việc hiện đại, trực quan với phân loại việc làm theo ca, địa điểm bản đồ trực tiếp tại Hà Nội, đánh giá mức độ uy tín nhà tuyển dụng và bảo vệ quyền lợi hai chiều.

---

## 🛠️ Kiến trúc & Công nghệ sử dụng

### 1. Frontend (Client-side)
* **Core Framework**: React 19 + Vite 6 (Fast HMR & Optimized Bundling).
* **Styling**: Tailwind CSS + Custom Dark Theme & Glassmorphism UI cao cấp.
* **Icons & UI Feedback**: Lucide React + Web Audio API Sound Effects (hiệu ứng pop, success, notification chân thực).
* **Bản đồ số**: Leaflet.js + OpenStreetMap (tương tác điểm lấy hàng, điểm giao hàng, tính cước việc vặt).
* **Realtime**: Socket.io Client (trao đổi tin nhắn trực tiếp giữa Ứng viên & Nhà tuyển dụng).

### 2. Backend (Server-side)
* **Runtime**: Node.js (ES Modules `type: "module"`).
* **Web Framework**: Express 5.x (Middleware tối ưu, Error handling mới).
* **Realtime Engine**: Socket.io Server (kênh chat bảo mật theo phòng `threadId` và xác thực JWT).
* **Cơ sở dữ liệu**: PostgreSQL (Hệ quản trị CSDL quan hệ chuẩn doanh nghiệp, connection pooling pg.Pool, ACID, Cascading Foreign Keys).
* **Bảo mật**:
  * Mã hóa mật khẩu một chiều với `bcryptjs` (salt rounds: 12).
  * Xác thực qua JSON Web Token (`jsonwebtoken`) kèm kiểm tra đối chiếu DB.
  * Phân quyền nghiêm ngặt theo vai trò (**RBAC**): `job_seeker`, `employer`, `admin`.
  * Bảo vệ header với `helmet` (chống clickjacking, MIME-sniffing, XSS).
  * Chống tấn công Brute-force & DoS với `express-rate-limit`.
  * CORS Allowlist chặt chẽ bảo vệ tài nguyên API.
  * Chống tấn công dò tìm tài khoản (Email Enumeration Prevention) ở luồng Quên mật khẩu.

### 3. Trí tuệ nhân tạo (AI Engine)
* Tích hợp **Google Gemini AI SDK** (`@google/genai`):
  * **AI Search & Matching**: Tìm việc bằng ngôn ngữ tự nhiên (Natural Query Parsing).
  * **AI CV Analyzer**: Phân tích CV ứng viên và chấm điểm độ tương thích với tin tuyển dụng.
  * **AI Copilot**: Trợ lý tư vấn viết CV và phỏng vấn trực tiếp trong ứng dụng.

---

## ✨ Các tính năng nổi bật

| Phân hệ | Tính năng chi tiết |
| :--- | :--- |
| **Tìm việc làm** | Tìm kiếm đa tiêu chí, phân loại ca làm (Sáng/Chiều/Tối/Gãy), bộ lọc mức lương, gắn cờ việc hot và tin tuyển dụng gấp. |
| **Hot Feed 3D** | Giao diện lướt thẻ việc làm 3D trực quan, điều hướng phím mũi tên, tương tác xem nhanh và ứng tuyển nhanh (Quick Apply). |
| **Cổng Tuyển Dụng** | Đăng tin, chỉnh sửa, ghim tin (Pin/Hot), xem danh sách ứng viên, duyệt hồ sơ (Chờ duyệt / Đã xem / Hẹn phỏng vấn / Từ chối). |
| **Dự án Freelance** | Đăng dự án freelance theo ngân sách/thời hạn, nộp hồ sơ chào thầu (Proposals). Bảo mật giá thầu: chỉ chủ dự án mới xem được bid của ứng viên. |
| **Bản đồ Việc vặt** | Bản đồ tương tác Leaflet hiển thị các cuốc giao nhận nhanh tại Hà Nội, tính quãng đường, ký biên bản giao nhận điện tử trước khi nhận đơn. |
| **Chat Thời gian thực** | Nhắn tin trực tiếp giữa NTD và Ứng viên với Socket.io, phân quyền thread chat, chỉ báo đang gõ (typing indicator). |
| **Đánh giá & Review** | Ứng viên chỉ được đánh giá công ty sau khi đã nộp đơn ứng tuyển thực tế (chống spam review), hiển thị số sao ⭐ và bình luận. |
| **Chuông Thông báo** | Tự động thông báo khi có đơn mới, đổi trạng thái hồ sơ, có tin nhắn mới, có chào thầu freelance hoặc nhận đánh giá. |

---

## 🔑 Tài khoản Demo thử nghiệm

Hệ thống tự động seed sẵn dữ liệu mẫu khi khởi động lần đầu:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| 🎓 **Ứng viên** | `minhanh.student@gmail.com` | `123456` | Ứng viên Nguyễn Minh Anh, sinh viên ĐHQGHN |
| 💼 **Nhà tuyển dụng 1** | `hr@thecoffeelab.vn` | `123456` | Chuỗi The Coffee Lab & Bistro (F&B) |
| 💼 **Nhà tuyển dụng 2** | `hr@nextgentech.vn` | `123456` | Công ty NextGen Tech Solutions (IT / Tech) |
| 🛡️ **Quản trị viên** | `admin@worklink.vn` | `123456` | Toàn quyền kiểm duyệt, quản trị người dùng & tin đăng |

*(Lưu ý: Bạn cũng có thể bấm nút "Đăng ký tài khoản" mới bất kỳ lúc nào ngay trên giao diện).*

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### Yêu cầu môi trường
* **Node.js**: Phiên bản **20.19 trở lên** (Bắt buộc — Vite 8 yêu cầu tối thiểu Node 20.19+).
* **npm**: Phiên bản 10.x trở lên.
* **PostgreSQL**: Phiên bản 14 trở lên (chạy cục bộ, Docker Compose, hoặc Cloud Database như Neon / Supabase).

### Bước 1: Cài đặt thư viện dependencies
```bash
npm install
```

### Bước 2: Khởi động Cơ sở dữ liệu PostgreSQL
Bạn có thể chọn một trong các cách sau:
* **Cách 2.1 — Khởi động nhanh bằng Docker (Khuyên dùng):**
  ```bash
  docker compose up -d postgres
  ```
  *(Tự động tạo container PostgreSQL 16 tại cổng 5432 với user `postgres`, pass `postgres`, db `worklink`).*

* **Cách 2.2 — Sử dụng PostgreSQL cục bộ hoặc Cloud (Neon.tech / Supabase / Render):**
  Tạo database tên `worklink` và cấu hình chuỗi kết nối vào file `.env`.

### Bước 3: Thiết lập file môi trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Trên Linux / macOS:
cp .env.example .env
```
Cấu hình chuỗi kết nối `DATABASE_URL` trong file `.env`:
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/worklink
```

### Bước 4: Khởi chạy ứng dụng

**Cách 1 — Chạy Full-stack tự động (Khuyên dùng):**
```bash
npm run fullstack
```
*Lệnh này sẽ tự động khởi động đồng thời cả Backend (port 5000) và Frontend Vite (port 5173).*

**Cách 2 — Khởi chạy nhanh trên Windows (1-Click):**
* Click đúp trực tiếp vào file **`start.bat`** ở thư mục gốc của dự án.

**Cách 3 — Chạy riêng lẻ 2 terminal:**
* Terminal 1 (Backend API): `npm run server` (chạy tại http://localhost:5000)
* Terminal 2 (Frontend Client): `npm run dev` (chạy tại http://localhost:5173)

---

## ⚙️ Cấu hình biến môi trường (.env)

| Tên biến | Bắt buộc | Giá trị mặc định / Gợi ý | Giải thích |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **BẮT BUỘC** | `postgresql://postgres:postgres@localhost:5432/worklink` | Chuỗi kết nối cơ sở dữ liệu PostgreSQL |
| `DATABASE_SSL` | Tùy chọn | `false` | Bật `true` nếu dùng cloud database có SSL (Neon, Supabase) |
| `PORT` | Không | `5000` | Cổng lắng nghe của máy chủ Express |
| `NODE_ENV` | Không | `development` | Môi trường chạy (`development` hoặc `production`) |
| `JWT_SECRET` | Khuyên dùng | Chuỗi ký tự ngẫu nhiên | Khóa bí mật ký mã token JWT (tạo nhanh bằng `npm run secret:generate`) |
| `ALLOWED_ORIGINS` | Không | `http://localhost:5173` | Danh sách domain được phép gọi API (phân tách bằng dấu phẩy) |
| `GEMINI_API_KEY` | Tùy chọn | `AIzaSy...` | Khóa API Google Gemini cho tính năng AI Search / CV Analyzer |
| `SMTP_HOST` | Tùy chọn | `smtp.gmail.com` | Máy chủ gửi email đặt lại mật khẩu thật |
| `SMTP_USER` | Tùy chọn | `your-email@gmail.com` | Email người gửi SMTP |
| `SMTP_PASS` | Tùy chọn | `app-password` | Mật khẩu ứng dụng (App Password) của email |

---

## 🧪 Hệ thống Kiểm thử Tự động (Automated Tests)

Dự án tích hợp bộ kiểm thử tự động toàn diện (Integration & Security Tests) với **25 kịch bản kiểm tra nghiêm ngặt**:
* Xác thực: Đăng ký, đăng nhập, đổi mật khẩu, quên mật khẩu an toàn, chống replay token.
* Bảo mật hạ tầng: Helmet headers, CORS allowlist, Rate-limiting chống brute-force.
* Phân quyền (RBAC): Chặn ứng viên đăng tin, chặn NTD nộp đơn, chống lộ giá thầu đối thủ.
* Vòng đời tuyển dụng: Đăng tin, sửa tin, nộp đơn, chặn nộp trùng (HTTP 409), rút đơn, dọn dẹp liên hoàn (Cascading delete).

Chạy kiểm thử:
```bash
npm test
```
*Kết quả mong đợi: `25 PASS / 0 FAIL`.*

---

## 📦 Hướng dẫn Đóng gói Nộp bài Chuẩn

> ⚠️ **Quy tắc quan trọng khi nộp bài**: Bài nộp đạt chuẩn **tuyệt đối KHÔNG được chứa**:
> 1. Thư mục `node_modules/` (nặng hàng chục MB, chứa hàng nghìn file rác do người chấm sẽ tự `npm install`).
> 2. File bí mật `.env` (chứa API key, mật khẩu, JWT secret cá nhân).
> 3. File cơ sở dữ liệu tạm thời hoặc file local database thừa (schema & dữ liệu mẫu được quản lý tập trung tại `database/schema.sql`, PostgreSQL tự động khởi tạo bảng và seed khi chạy).
> 4. Thư mục `dist/` (build tạm).

### Cách 1: Sử dụng Script tự động có sẵn trong dự án (Nhanh nhất & Chính xác nhất)
Chạy lệnh sau tại thư mục gốc:
```bash
npm run pack
```
*Script sẽ tự động quét, loại trừ mọi file rác và bí mật, tạo ra file **`WorkLink_Submission.zip`** siêu nhẹ (~0.25 MB) sẵn sàng nộp bài ngay lập tức.*

### Cách 2: Nén thủ công bằng tay (Nếu muốn tự zip)
Nếu bạn nén bằng WinRAR, 7-Zip hoặc Windows Zip:
1. Đảm bảo xóa hoặc bỏ chọn các mục sau trước khi nén:
   * ❌ `node_modules`
   * ❌ `.env` (chỉ giữ lại `.env.example`)
   * ❌ File cơ sở dữ liệu tạm thời / file log thừa (`*.log`)
   * ❌ `dist`
   * ❌ Thư mục `.git` (nếu có)
   * ❌ Các file `.zip` cũ nằm bên trong
2. Các thư mục **bắt buộc phải có**:
   * ✅ `server/`
   * ✅ `src/`
   * ✅ `shared/`
   * ✅ `database/` (chứa file `schema.sql`)
   * ✅ `public/`
   * ✅ `package.json` và `package-lock.json`
   * ✅ `index.html`, `vite.config.js`
   * ✅ `README.md`, `DEPLOY.md`, `Dockerfile`, `.env.example`, `start.bat`

---

## 🐳 Hướng dẫn Triển khai Production & Docker Compose

### Khởi chạy 1-Click với Docker Compose (Cả PostgreSQL và WorkLink App):
```bash
# Khởi chạy toàn bộ hệ thống ở chế độ background
docker compose up -d --build
```
Truy cập ứng dụng tại: `http://localhost:5000`.

*Lệnh trên sẽ tự động khởi tạo container PostgreSQL 16 và container WorkLink Fullstack (đã build dist), tự động chờ PostgreSQL sẵn sàng rồi mới kết nối.*

Xem thêm hướng dẫn chi tiết về triển khai lên **Render.com**, **Neon.tech**, **Railway.app** và **VPS Nginx** trong tài liệu [DEPLOY.md](file:///d:/Download/MInh/DEPLOY.md).
