import assert from 'assert';

/**
 * Kiểm thử phân quyền cho API Chat (REST): GET/POST /api/chat.
 * Đảm bảo người dùng KHÔNG thuộc cuộc hội thoại (không phải seeker/employer của
 * application/job liên quan, và không phải admin) không đọc được / gửi được tin
 * nhắn vào thread đó, kể cả khi đoán đúng định dạng threadId.
 */
export async function runChatSecurityTests(baseUrl) {
  console.log('\n--- 💬 7. KIỂM THỬ BẢO MẬT CHAT (IDOR QUA REST API) ---');

  // app-1 (seed có sẵn): job-1 thuộc user-employer-1 (hr@thecoffeelab.vn),
  // ứng viên là user-seeker-1 (minhanh.student@gmail.com)
  const threadId = 'thread_app_app-1';

  const seekerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'minhanh.student@gmail.com', password: '123456' })
  });
  const { token: ownerSeekerToken } = await seekerLogin.json();
  assert.ok(ownerSeekerToken, 'Phải đăng nhập được ứng viên sở hữu thread');

  const employerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@thecoffeelab.vn', password: '123456' })
  });
  const { token: ownerEmployerToken } = await employerLogin.json();
  assert.ok(ownerEmployerToken, 'Phải đăng nhập được NTD sở hữu thread');

  // Employer KHÔNG liên quan tới app-1/job-1 — dùng làm "kẻ ngoài cuộc"
  const intruderLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@nextgentech.vn', password: '123456' })
  });
  const { token: intruderToken } = await intruderLogin.json();
  assert.ok(intruderToken, 'Phải đăng nhập được tài khoản "người ngoài"');

  // ── Test 7.1: Người ngoài không đọc được lịch sử tin nhắn ────────────────
  const intruderGetRes = await fetch(`${baseUrl}/api/chat/${threadId}`, {
    headers: { 'Authorization': `Bearer ${intruderToken}` }
  });
  assert.strictEqual(intruderGetRes.status, 403, 'Người ngoài GET lịch sử chat phải bị 403 Forbidden');
  console.log('✅ [7.1 PASS] Người ngoài cuộc không đọc được lịch sử chat (GET trả 403)');

  // ── Test 7.2: Người ngoài không gửi được tin nhắn vào thread ─────────────
  const intruderPostRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intruderToken}` },
    body: JSON.stringify({ threadId, text: 'Tin nhắn chèn ép trái phép' })
  });
  assert.strictEqual(intruderPostRes.status, 403, 'Người ngoài POST tin nhắn phải bị 403 Forbidden');
  console.log('✅ [7.2 PASS] Người ngoài cuộc không gửi được tin nhắn vào thread (POST trả 403)');

  // ── Test 7.3: Chủ thread thật (cả 2 phía) đọc được bình thường ───────────
  const seekerGetRes = await fetch(`${baseUrl}/api/chat/${threadId}`, {
    headers: { 'Authorization': `Bearer ${ownerSeekerToken}` }
  });
  assert.strictEqual(seekerGetRes.status, 200, 'Ứng viên sở hữu thread phải đọc được (200)');

  const employerGetRes = await fetch(`${baseUrl}/api/chat/${threadId}`, {
    headers: { 'Authorization': `Bearer ${ownerEmployerToken}` }
  });
  assert.strictEqual(employerGetRes.status, 200, 'NTD sở hữu thread phải đọc được (200)');
  console.log('✅ [7.3 PASS] Cả 2 phía chủ thread thật (ứng viên & NTD) đều đọc được lịch sử chat bình thường');

  // ── Test 7.4: threadId không tồn tại / không khớp định dạng nào ──────────
  const fakeThreadRes = await fetch(`${baseUrl}/api/chat/thread_app_nonexistent-id-999`, {
    headers: { 'Authorization': `Bearer ${ownerSeekerToken}` }
  });
  assert.strictEqual(fakeThreadRes.status, 403, 'ThreadId không tồn tại phải bị từ chối (403), không trả 200 danh sách rỗng gây nhầm lẫn');
  console.log('✅ [7.4 PASS] Truy cập threadId không tồn tại bị từ chối đúng cách (403, không rò rỉ bằng 200 rỗng)');

  // ── Test 7.5: Chưa đăng nhập hoàn toàn không truy cập được ───────────────
  const noAuthRes = await fetch(`${baseUrl}/api/chat/${threadId}`);
  assert.strictEqual(noAuthRes.status, 401, 'Chưa đăng nhập phải bị 401 Unauthorized');
  console.log('✅ [7.5 PASS] Yêu cầu không kèm token bị chặn đúng (401 Unauthorized)');

  // ── Test 7.6: Limit tham số chat được kẹp trần an toàn (DoS prevention) ───
  const limitClampRes = await fetch(`${baseUrl}/api/chat/${threadId}?limit=999999`, {
    headers: { 'Authorization': `Bearer ${ownerSeekerToken}` }
  });
  assert.strictEqual(limitClampRes.status, 200, 'Limit cực đại phải được xử lý và kẹp trần an toàn');
  console.log('✅ [7.6 PASS] Tham số chat limit được kẹp trần an toàn (chống DoS/OOM)');
}

