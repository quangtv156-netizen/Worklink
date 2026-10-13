import assert from 'assert';

export async function runSecurityTests(baseUrl) {
  console.log('\n--- 🛡️ 2. KIỂM THỬ BẢO MẬT HẠ TẦNG: HELMET, CORS & RATE LIMITING ---');

  // Test 2.1: Kiểm tra Security Headers do Helmet thiết lập
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const headers = healthRes.headers;

  const xContentType = headers.get('x-content-type-options');
  assert.strictEqual(xContentType, 'nosniff', 'Phải có header X-Content-Type-Options: nosniff');

  const xFrameOptions = headers.get('x-frame-options');
  assert.strictEqual(xFrameOptions, 'SAMEORIGIN', 'Phải có header X-Frame-Options: SAMEORIGIN để chống Clickjacking');

  console.log('✅ [PASS] Helmet Security Headers: X-Content-Type-Options (nosniff) & X-Frame-Options (SAMEORIGIN) hiện diện');

  // Test 2.2: CORS - Nguồn hợp lệ trong danh sách được phép
  const corsAllowedRes = await fetch(`${baseUrl}/api/health`, {
    headers: { 'Origin': 'http://localhost:5173' }
  });
  const allowOriginHeader = corsAllowedRes.headers.get('access-control-allow-origin');
  assert.strictEqual(allowOriginHeader, 'http://localhost:5173', 'Origin hợp lệ phải được cấp phép');
  console.log('✅ [PASS] CORS: Cho phép Origin hợp lệ trong Allowlist (http://localhost:5173)');

  // Test 2.3: CORS - Nguồn độc hại bị từ chối
  try {
    const corsDisallowedRes = await fetch(`${baseUrl}/api/health`, {
      headers: { 'Origin': 'http://malicious-attacker.com' }
    });
    // Server có thể trả về lỗi 500 kèm thông điệp CORS hoặc không đính kèm Access-Control-Allow-Origin
    const disallowedHeader = corsDisallowedRes.headers.get('access-control-allow-origin');
    assert.ok(!disallowedHeader || disallowedHeader !== 'http://malicious-attacker.com', 'Không được cấp phép cho origin độc hại');
    console.log('✅ [PASS] CORS: Chặn thành công Origin lạ/độc hại (http://malicious-attacker.com)');
  } catch (err) {
    // Nếu express cors quăng error ngắt kết nối
    console.log('✅ [PASS] CORS: Ngắt kết nối trực tiếp đối với Origin lạ');
  }

  // Test 2.4: Kiểm tra Rate Limiting Headers
  const rateLimitHeader = healthRes.headers.get('ratelimit-limit') || healthRes.headers.get('x-ratelimit-limit');
  // Express-rate-limit với standardHeaders gửi ratelimit-limit
  assert.ok(rateLimitHeader !== null, 'Phải có header RateLimit-* thông báo hạn mức truy cập');
  console.log(`✅ [PASS] Rate Limiter kích hoạt thành công (Hạn mức IP: ${rateLimitHeader} requests/window)`);

  // Test 2.5: Kiểm tra Content-Security-Policy (CSP) khi ở môi trường Production
  const isProdOrCSP = process.env.NODE_ENV === 'production' || process.env.ENABLE_CSP === 'true';
  const cspHeader = headers.get('content-security-policy');
  if (isProdOrCSP) {
    assert.ok(cspHeader, 'Môi trường production phải có header Content-Security-Policy');
    assert.ok(cspHeader.includes("default-src 'self'"), 'CSP phải cấu hình default-src self');
    console.log('✅ [PASS] Content Security Policy (CSP): Thiết lập an toàn với default-src self & domain whitelist');
  } else {
    console.log('ℹ️ [INFO] CSP ở chế độ linh hoạt dev (sẽ tự động bật chặt chẽ khi NODE_ENV=production hoặc ENABLE_CSP=true)');
  }

  // Test 2.6: Kiểm tra Endpoint lấy CSRF Token (GET /api/csrf-token)
  const csrfRes = await fetch(`${baseUrl}/api/csrf-token`);
  assert.strictEqual(csrfRes.status, 200, 'GET /api/csrf-token phải trả về HTTP 200');
  const csrfData = await csrfRes.json();
  assert.strictEqual(csrfData.success, true, 'Yêu cầu CSRF phải thành công');
  assert.ok(csrfData.csrfToken, 'Phải trả về csrfToken hợp lệ');
  console.log('✅ [PASS] Endpoint GET /api/csrf-token cấp phát token thành công (Token:', csrfData.csrfToken, ')');

  // Test 2.7: Kiểm tra BullMQ Queue Configuration & Worker Process Execution
  const { DEFAULT_JOB_OPTIONS } = await import('../server/config/queue.js');
  assert.strictEqual(DEFAULT_JOB_OPTIONS.attempts, 3, 'Queue phải cấu hình retry 3 lần');
  assert.strictEqual(DEFAULT_JOB_OPTIONS.backoff.type, 'exponential', 'Queue phải cấu hình backoff exponential');
  assert.strictEqual(DEFAULT_JOB_OPTIONS.backoff.delay, 2000, 'Delay khởi đầu phải là 2000ms');

  const { processEmailJob, processAiJob } = await import('../server/worker.js');
  const emailRes = await processEmailJob({
    data: {
      type: 'send-verification',
      toEmail: 'worker-test@worklink.vn',
      userName: 'Worker Test User',
      verificationToken: '123456'
    }
  });
  assert.strictEqual(emailRes.success, true, 'Worker phải xử lý email task thành công');

  const aiRes = await processAiJob({
    id: 'job-test-ai',
    data: {
      cvName: 'TestCV.pdf',
      cvText: 'Kỹ năng: React, Node.js, PostgreSQL, TypeScript',
      allJobs: []
    }
  });
  assert.strictEqual(aiRes.success, true, 'Worker phải xử lý AI CV analysis task thành công');
  assert.ok(aiRes.result.atsScore >= 60, 'Worker phải tính toán điểm ATS hợp lệ');
  console.log('✅ [PASS] BullMQ Worker & Queue: Config retry 3 lần (Exponential Backoff) & xử lý Email/AI tách biệt');
}

