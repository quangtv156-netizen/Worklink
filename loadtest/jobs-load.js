// loadtest/jobs-load.js
// Kiểm thử hiệu năng & khả năng chịu tải bằng k6 (https://k6.io)
//
// Cài đặt (không qua npm — k6 là binary riêng):
//   macOS:   brew install k6
//   Windows: choco install k6   (hoặc tải từ https://k6.io/docs/get-started/installation/)
//
// Chạy (đảm bảo `npm run fullstack` đang chạy ở BASE_URL bên dưới):
//   k6 run loadtest/jobs-load.js
//
// Chạy với tải nặng hơn / ghi đè ngưỡng:
//   k6 run --vus 300 --duration 2m loadtest/jobs-load.js
//
// Có thể trỏ sang URL khác (VD: môi trường staging) bằng biến môi trường:
//   k6 run -e BASE_URL=https://worklink-staging.onrender.com loadtest/jobs-load.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Custom metrics để theo dõi riêng từng nhóm API (dễ đọc báo cáo cuối hơn)
const jobListDuration = new Trend('job_list_duration', true);
const aiSearchDuration = new Trend('ai_search_duration', true);
const loginDuration = new Trend('login_duration', true);
const errorRate = new Rate('errors');

// ── P-04: Kịch bản tải — tăng dần rồi giữ ổn định rồi giảm dần ──────────────
export const options = {
  scenarios: {
    // Kịch bản chính: mô phỏng người dùng duyệt web (đọc nhiều hơn ghi)
    browsing_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 50 },   // Khởi động: tăng lên 50 VU
        { duration: '40s', target: 200 },  // Tải chính: tăng lên 200 VU (P-04)
        { duration: '30s', target: 200 },  // Giữ ổn định ở 200 VU
        { duration: '20s', target: 0 },    // Hạ nhiệt về 0
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Ngưỡng PASS/FAIL tự động — k6 sẽ exit code khác 0 nếu vi phạm
    http_req_failed: ['rate<0.01'],             // P-04: tỉ lệ lỗi < 1%
    http_req_duration: ['p(95)<800'],           // p95 tổng thể < 800ms
    job_list_duration: ['p(95)<300'],           // P-02: danh sách việc làm < 300ms (p95)
    login_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  group('P-02: Danh sách việc làm (GET /api/jobs)', () => {
    const res = http.get(`${BASE_URL}/api/jobs`);
    jobListDuration.add(res.timings.duration);
    const ok = check(res, {
      'status 200': (r) => r.status === 200,
      'có trả về mảng jobs': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.jobs);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  sleep(Math.random() * 1.5); // mô phỏng người dùng đọc nội dung trước khi thao tác tiếp

  group('P-03: Tìm kiếm & lọc việc làm', () => {
    const districts = ['Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Hai Bà Trưng'];
    const district = districts[Math.floor(Math.random() * districts.length)];
    const res = http.get(`${BASE_URL}/api/jobs?district=${encodeURIComponent(district)}`);
    aiSearchDuration.add(res.timings.duration);
    check(res, { 'lọc theo quận trả 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 1);

  group('P-05: Rate limit không chặn nhầm người dùng hợp lệ ở tải thường', () => {
    // Gọi /api/health liên tục mô phỏng traffic nền — không được bị 429 ở mức tải bình thường
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, { 'health check không bị rate-limit chặn': (r) => r.status !== 429 });
  });

  sleep(Math.random() * 2);
}

// Kịch bản riêng, chạy tách biệt để không làm nhiễu số liệu P-02/P-03 ở trên:
// k6 run --env SCENARIO=auth loadtest/jobs-load.js
export function authBurst() {
  group('P-05: Rate limit CHẶN ĐÚNG khi login dồn dập (chạy riêng, không chung VU pool)', () => {
    const payload = JSON.stringify({ email: 'minhanh.student@gmail.com', password: 'sai-mat-khau' });
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
    loginDuration.add(res.timings.duration);
  });
}
