import assert from 'assert';
import { get } from '../server/db.js';

export async function runAuthTests(baseUrl) {
  console.log('\n--- 🧪 1. KIỂM THỬ XÁC THỰC, MẬT KHẨU & BẢO MẬT EMAIL ---');

  // Test 1.1: Chặn email sai định dạng
  const badEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Bad Email',
      email: 'invalid-email-format',
      password: 'password123',
      role: 'job_seeker'
    })
  });
  const badEmailData = await badEmailRes.json();
  assert.strictEqual(badEmailRes.status, 400, 'Phải trả về 400 khi email không đúng định dạng');
  assert.ok(badEmailData.message.includes('email'), 'Thông báo phải nhắc nhở về định dạng email');
  console.log('✅ [PASS] Chặn đăng ký email không hợp lệ (HTTP 400)');

  // Test 1.2: Chặn mật khẩu quá ngắn (< 6 ký tự)
  const shortPassRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Short Password',
      email: `test_short_${Date.now()}@worklink.vn`,
      password: '123',
      role: 'job_seeker'
    })
  });
  assert.strictEqual(shortPassRes.status, 400, 'Phải trả về 400 khi mật khẩu ngắn hơn 8 ký tự');
  console.log('✅ [PASS] Chặn đăng ký mật khẩu dưới 8 ký tự (HTTP 400)');

  // Test 1.3: Đăng ký thành công với email hợp lệ và mật khẩu chuẩn
  const testUserEmail = `user_test_${Date.now()}@worklink.vn`;
  const initialPassword = 'InitialSecurePass123!';
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nguyen Van Test',
      email: testUserEmail,
      password: initialPassword,
      role: 'job_seeker',
      phone: '0912345678',
      district: 'Cầu Giấy'
    })
  });
  const regData = await regRes.json();
  assert.strictEqual(regRes.status, 201, 'Đăng ký phải trả về HTTP 201');
  assert.ok(regData.token, 'Phải trả về JWT token');
  console.log('✅ [PASS] Đăng ký tài khoản hợp lệ thành công (HTTP 201, nhận JWT token)');

  // Test 1.4: Chống đăng ký trùng email
  const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nguyen Van Test Trùng',
      email: testUserEmail,
      password: 'SomeOtherPassword123!',
      role: 'job_seeker'
    })
  });
  assert.strictEqual(dupRes.status, 400, 'Phải trả về 400 khi email đã tồn tại');
  console.log('✅ [PASS] Chống đăng ký trùng email thành công (HTTP 400)');

  // Test 1.5: Đăng nhập với mật khẩu sai bị từ chối
  const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: 'WrongPassword999!' })
  });
  assert.strictEqual(badLoginRes.status, 401, 'Sai mật khẩu phải trả về 401');
  console.log('✅ [PASS] Chặn đăng nhập sai mật khẩu (HTTP 401)');

  // Test 1.6: Đăng nhập thành công với mật khẩu đúng
  const goodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: initialPassword })
  });
  const goodLoginData = await goodLoginRes.json();
  assert.strictEqual(goodLoginRes.status, 200, 'Đăng nhập đúng phải trả về 200');
  const userToken = goodLoginData.token;
  assert.ok(userToken, 'Đăng nhập thành công phải có token');
  console.log('✅ [PASS] Đăng nhập thành công với mật khẩu chính xác (HTTP 200)');

  // Test 1.7: Đổi mật khẩu - Sai mật khẩu cũ bị từ chối
  const badChangeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      currentPassword: 'WrongCurrentPassword!',
      newPassword: 'BrandNewPassword456!'
    })
  });
  assert.strictEqual(badChangeRes.status, 400, 'Mật khẩu cũ không đúng phải trả về 400');
  console.log('✅ [PASS] Chặn đổi mật khẩu khi nhập sai mật khẩu cũ (HTTP 400)');

  // Test 1.8: Đổi mật khẩu thành công
  const newPassword = 'BrandNewPassword456!';
  const goodChangeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword: newPassword
    })
  });
  const goodChangeData = await goodChangeRes.json();
  assert.strictEqual(goodChangeRes.status, 200, 'Đổi mật khẩu đúng phải trả về 200');
  assert.strictEqual(goodChangeData.success, true);
  console.log('✅ [PASS] Đổi mật khẩu thành công với xác thực token (HTTP 200)');

  // Test 1.9: Đăng nhập bằng mật khẩu mới thành công, mật khẩu cũ không còn tác dụng
  const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: initialPassword })
  });
  assert.strictEqual(oldLoginRes.status, 401, 'Mật khẩu cũ không được phép đăng nhập nữa');

  const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: newPassword })
  });
  assert.strictEqual(newLoginRes.status, 200, 'Phải đăng nhập được bằng mật khẩu mới');
  console.log('✅ [PASS] Xác nhận mật khẩu mới hoạt động và mật khẩu cũ bị vô hiệu hóa');

  // Test 1.10: Quy trình Quên mật khẩu an toàn (Không lộ token trong JSON response)
  const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail })
  });
  const forgotData = await forgotRes.json();
  assert.strictEqual(forgotRes.status, 200, 'Yêu cầu forgot-password phải trả về 200');
  assert.strictEqual(forgotData.resetToken, undefined, 'Tuyệt đối KHÔNG trả resetToken trong JSON response để chống Account Takeover');
  assert.strictEqual(forgotData.success, true);
  console.log('✅ [PASS] Chống chiếm đoạt tài khoản: POST /forgot-password không trả resetToken về client');

  // Test 1.11: Chống tấn công dò tìm email (Email Enumeration Prevention)
  const fakeEmail = `nonexistent_user_${Date.now()}@worklink.vn`;
  const fakeForgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fakeEmail })
  });
  const fakeForgotData = await fakeForgotRes.json();
  assert.strictEqual(fakeForgotRes.status, 200, 'Email không tồn tại cũng phải trả về 200');
  assert.strictEqual(fakeForgotData.message, forgotData.message, 'Thông báo phải giống hệt nhau để không lộ email đã đăng ký');
  assert.strictEqual(fakeForgotData.resetToken, undefined, 'Không được trả token cho email không tồn tại');
  console.log('✅ [PASS] Chống tấn công dò tìm email: Trả về thông báo đồng nhất (HTTP 200) cho mọi email');

  // Test 1.12: Lấy token bảo mật từ DB/Server log và thực hiện đổi mật khẩu
  const tokenRecord = await get(
    'SELECT token FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1',
    [testUserEmail]
  );
  assert.ok(tokenRecord && tokenRecord.token, 'Server phải lưu token bảo mật nội bộ để kiểm tra đơn lần');

  const resetPasswordValue = 'ResetPasswordFinal789!';
  const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resetToken: tokenRecord.token,
      newPassword: resetPasswordValue
    })
  });
  const resetData = await resetRes.json();
  assert.strictEqual(resetRes.status, 200, 'Đặt lại mật khẩu với token phải trả về 200');
  assert.strictEqual(resetData.success, true);

  // Test 1.13: Chống tấn công Replay Attack (Token chỉ dùng được 1 lần duy nhất)
  const replayRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resetToken: tokenRecord.token,
      newPassword: 'AnotherPasswordTry999!'
    })
  });
  assert.strictEqual(replayRes.status, 400, 'Token đã sử dụng không được phép tái sử dụng (Single-use token)');
  console.log('✅ [PASS] Chống tấn công Replay Attack: Token bị hủy ngay sau khi sử dụng thành công');

  // Test 1.14: Đăng nhập lại với mật khẩu vừa reset thành công
  const resetLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: resetPasswordValue })
  });
  assert.strictEqual(resetLoginRes.status, 200, 'Phải đăng nhập thành công với mật khẩu vừa reset');
  console.log('✅ [PASS] Toàn bộ quy trình Quên mật khẩu & Đặt lại mật khẩu (Forgot/Reset) bảo mật hoàn tất');

  // Test 1.15: Kiểm thử cơ chế Account Lockout (S8 - Khóa tài khoản 15 phút khi nhập sai mật khẩu 5 lần)
  const lockoutUserEmail = `lockout_test_${Date.now()}@worklink.vn`;
  const lockoutPassword = 'ValidPassword123!';
  await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User Lockout Test',
      email: lockoutUserEmail,
      password: lockoutPassword,
      role: 'job_seeker'
    })
  });

  // Nhập sai mật khẩu 4 lần đầu -> Trả về 401
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wrongRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockoutUserEmail, password: 'WrongPassword!' })
    });
    assert.strictEqual(wrongRes.status, 401, `Lần thử sai thứ ${attempt} phải trả về 401`);
  }

  // Lần thử sai thứ 5 -> Kích hoạt khóa tài khoản 15 phút (HTTP 423 Locked)
  const lockTriggerRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: lockoutUserEmail, password: 'WrongPassword!' })
  });
  assert.strictEqual(lockTriggerRes.status, 423, 'Lần thử sai thứ 5 phải trả về HTTP 423 (Locked)');
  const lockData = await lockTriggerRes.json();
  assert.strictEqual(lockData.locked, true, 'Response phải chứa cờ locked: true');

  // Lần thứ 6 kể cả khi nhập ĐÚNG mật khẩu cũng phải bị chặn 423 do tài khoản đang bị khóa
  const blockedGoodRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: lockoutUserEmail, password: lockoutPassword })
  });
  assert.strictEqual(blockedGoodRes.status, 423, 'Tài khoản đang bị khóa phải bị từ chối 423 kể cả khi nhập đúng mật khẩu');
  console.log('✅ [PASS] Chống Brute-force: Khóa tài khoản 15 phút sau 5 lần nhập sai mật khẩu (Redis Lockout)');
}
