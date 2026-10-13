import assert from 'assert';
import fs from 'fs';
import path from 'path';

export async function runAuditFixesTests(baseUrl = 'http://localhost:5000') {
  console.log('\n--- 🛡️ 5. KIỂM THỬ CÁC LỖ HỔNG AUDIT MỚI ĐƯỢC KHẮC PHỤC ---');

  // 1. Login Employer & Seeker & Admin
  const empLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@thecoffeelab.vn', password: '123456' })
  });
  const empData = await empLogin.json();
  const empToken = empData.token;

  const seekerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'minhanh.student@gmail.com', password: '123456' })
  });
  const seekerToken = (await seekerLogin.json()).token;

  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@worklink.vn', password: '123456' })
  });
  const adminToken = (await adminLogin.json()).token;

  const { run: runSql, get: getSql } = await import('../server/db.js');
  await runSql("UPDATE users SET ai_quota = 5 WHERE email = 'minhanh.student@gmail.com'");

  // 1.1: NTD không thể tự boost Hot/Pin
  const boostRes = await fetch(`${baseUrl}/api/jobs/job-1/boost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({ type: 'hot' })
  });
  assert.strictEqual(boostRes.status, 403, 'NTD tự boost hot/pin phải bị 403 Forbidden');
  console.log('✅ [1.1 PASS] NTD tự boost hot/pin bị từ chối 403 Forbidden (chỉ Admin được boost)');

  // Admin boost thành công
  const adminBoostRes = await fetch(`${baseUrl}/api/jobs/job-1/boost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ type: 'hot' })
  });
  assert.strictEqual(adminBoostRes.status, 200, 'Admin boost hot/pin phải thành công');
  console.log('✅ [1.1 PASS] Admin boost hot/pin thành công (HTTP 200)');

  // 1.6: POST job thiếu title phải trả về 400
  const noTitleJobRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({
      company: 'Test Company',
      category: 'F&B'
    })
  });
  assert.strictEqual(noTitleJobRes.status, 400, 'POST job không có title phải trả về 400 Bad Request');
  console.log('✅ [1.6 PASS] POST job không có title bị từ chối 400 Bad Request');

  // 1.2: Chủ gig không thể đổi status qua PUT /api/gigs/:id
  const createGigRes = await fetch(`${baseUrl}/api/gigs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({
      title: 'Giao tài liệu khẩn cấp',
      reward: '50.000đ',
      rewardNum: 50000,
      cargoType: 'Tài liệu',
      sender: '0912345678',
      receiver: '0987654321',
      pickupLocation: { name: 'Điểm lấy', address: '123 Cầu Giấy', lat: 21.03, lng: 105.79 },
      dropoffLocation: { name: 'Điểm giao', address: '456 Kim Mã', lat: 21.03, lng: 105.81 }
    })
  });
  const createdGigData = await createGigRes.json();
  const testGigId = createdGigData.gig.id;

  // Thử đổi status qua PUT thành COMPLETED
  const tamperStatusRes = await fetch(`${baseUrl}/api/gigs/${testGigId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({
      title: 'Giao tài liệu sửa',
      status: 'COMPLETED'
    })
  });
  const tamperStatusData = await tamperStatusRes.json();
  assert.strictEqual(tamperStatusData.gig.status, 'AVAILABLE', 'Status không được đổi qua PUT (phải giữ AVAILABLE)');
  console.log('✅ [1.2 PASS] Chủ gig không thể đổi status tùy ý qua PUT (vẫn giữ AVAILABLE)');

  // Cleanup gig
  await fetch(`${baseUrl}/api/gigs/${testGigId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });

  // 2.7: Upload CV bắt buộc đăng nhập (authenticateToken)
  const unauthUploadRes = await fetch(`${baseUrl}/api/cv/upload`, {
    method: 'POST'
  });
  assert.strictEqual(unauthUploadRes.status, 401, 'Upload CV không có JWT phải trả về 401 Unauthorized');
  console.log('✅ [2.7 PASS] Upload CV không có token bị từ chối 401 Unauthorized');

  // 2.4: Token Versioning & Password Change Revocation
  // Tạo user test riêng
  const testEmail = `token_ver_${Date.now()}@worklink.vn`;
  const regUserRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'User Token Ver',
      email: testEmail,
      password: 'OldPassword123!',
      role: 'job_seeker'
    })
  });
  const regUserData = await regUserRes.json();
  const oldToken = regUserData.token;

  // Đổi mật khẩu
  const changePassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${oldToken}`
    },
    body: JSON.stringify({
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!'
    })
  });
  assert.strictEqual(changePassRes.status, 200, 'Đổi mật khẩu phải thành công');

  // Thử dùng oldToken truy cập /api/auth/me -> phải bị 401 do token_version cũ
  const testOldTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${oldToken}` }
  });
  assert.strictEqual(testOldTokenRes.status, 401, 'Token cũ sau khi đổi mật khẩu phải bị 401 Unauthorized');
  console.log('✅ [2.4 PASS] Token cũ lập tức bị vô hiệu hóa sau khi đổi mật khẩu (Token Versioning)');

  // 1.8: CV Analyze query không lỗi và ghép việc làm thành công
  const cvAnalyzeRes = await fetch(`${baseUrl}/api/cv/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      cvText: 'Nguyễn Minh Anh. Lập trình viên React, Node.js, Express, JavaScript, PostgreSQL, fullstack web.'
    })
  });
  assert.strictEqual(cvAnalyzeRes.status, 200, 'Phân tích CV phải trả về 200 OK');
  const cvData = await cvAnalyzeRes.json();
  assert.strictEqual(cvData.success, true, 'CV analyze success phải là true');
  assert.ok(Array.isArray(cvData.matchedJobs), 'matchedJobs phải là mảng');
  if (cvData.matchedJobs.length > 0) {
    const topJob = cvData.matchedJobs[0];
    assert.strictEqual(topJob.breakdown.skillWeight, '60%', 'Trọng số kỹ năng phải là 60%');
    assert.strictEqual(topJob.breakdown.experienceWeight, '40%', 'Trọng số kinh nghiệm phải là 40%');
  }
  console.log(`✅ [1.8 PASS] CV Analyze query CSDL thành công (ghép được ${cvData.matchedJobs.length} việc làm với trọng số 60% skills + 40% exp)`);

  // 1.9: Parser 15MB cho /api/cv chấp nhận payload > 1MB (không bị 413)
  const largeFakeBase64 = 'A'.repeat(1.2 * 1024 * 1024); // 1.2 MB string
  const largeCvRes = await fetch(`${baseUrl}/api/cv/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      cvText: 'Hồ sơ thử nghiệm tải trọng lớn với dung lượng trên 1MB',
      fileBase64: largeFakeBase64,
      mimeType: 'application/pdf'
    })
  });
  assert.notStrictEqual(largeCvRes.status, 413, 'Router /api/cv phải chấp nhận payload > 1MB (không bị 413 Payload Too Large)');
  console.log('✅ [1.9 PASS] Route /api/cv hỗ trợ payload 15MB thành công (không bị 413 bởi parser 1MB chung)');

  // 2.0: Rating validation: Whitelist targetType & phân quyền đúng đối tượng
  // 2.0.1: targetType không hợp lệ -> 400
  const invalidTargetRating = await fetch(`${baseUrl}/api/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      jobId: 'job-1',
      targetType: 'hacker_type',
      stars: 5
    })
  });
  assert.strictEqual(invalidTargetRating.status, 400, 'targetType không hợp lệ phải trả về 400 Bad Request');

  // 2.0.2: Ứng viên gửi targetType applicant -> 403
  const seekerApplicantRating = await fetch(`${baseUrl}/api/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      jobId: 'job-1',
      targetType: 'applicant',
      stars: 5
    })
  });
  assert.strictEqual(seekerApplicantRating.status, 403, 'Ứng viên không được đánh giá targetType applicant (403)');
  console.log('✅ [2.0 PASS] Đánh giá được whitelist targetType và kiểm soát chặt đối tượng theo vai trò');

  // 2.1: Gig State Transition: Không cho chuyển AVAILABLE -> COMPLETED trực tiếp
  const testFlowGigRes = await fetch(`${baseUrl}/api/gigs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({
      title: 'Cuốc test flow trạng thái',
      reward: '70.000đ',
      rewardNum: 70000,
      cargoType: 'Hàng nhẹ',
      sender: '0912345678',
      receiver: '0987654321',
      pickupLocation: { name: 'Điểm lấy', address: '123 Cầu Giấy', lat: 21.03, lng: 105.79 },
      dropoffLocation: { name: 'Điểm giao', address: '456 Kim Mã', lat: 21.03, lng: 105.81 }
    })
  });
  const flowGigData = await testFlowGigRes.json();
  const flowGigId = flowGigData.gig.id;

  // Thử hoàn thành khi chưa ai nhận (đang AVAILABLE) -> phải bị 400
  const earlyCompleteRes = await fetch(`${baseUrl}/api/gigs/${flowGigId}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  assert.strictEqual(earlyCompleteRes.status, 400, 'Không thể hoàn thành cuốc việc vặt khi chưa có người nhận làm (400)');

  // Ứng viên nhận cuốc -> thành công chuyển sang ACCEPTED
  const acceptGigRes = await fetch(`${baseUrl}/api/gigs/${flowGigId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${seekerToken}` }
  });
  assert.strictEqual(acceptGigRes.status, 200, 'Ứng viên nhận cuốc thành công (200)');

  // Bây giờ chủ cuốc mới được hoàn thành
  const validCompleteRes = await fetch(`${baseUrl}/api/gigs/${flowGigId}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  assert.strictEqual(validCompleteRes.status, 200, 'Hoàn thành cuốc việc vặt sau khi đã ACCEPTED thành công (200)');
  console.log('✅ [2.1 PASS] Quy trình trạng thái việc vặt tuân thủ nghiêm ngặt (AVAILABLE -> ACCEPTED -> COMPLETED)');

  // Cleanup gig
  await fetch(`${baseUrl}/api/gigs/${flowGigId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });

  // 2.2: Đồng bộ việc làm ngoài (External Jobs Sync) với Admin Auth
  const syncAdminRes = await fetch(`${baseUrl}/api/external-jobs/sync`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(syncAdminRes.status, 200, 'Admin đồng bộ việc làm ngoài phải thành công 200 OK');

  const syncSeekerRes = await fetch(`${baseUrl}/api/external-jobs/sync`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${seekerToken}` }
  });
  assert.strictEqual(syncSeekerRes.status, 403, 'Ứng viên đồng bộ việc làm ngoài phải bị 403 Forbidden');
  console.log('✅ [2.2 PASS] Đồng bộ việc làm ngoài xác thực chuẩn xác authenticateToken + requireAdmin');

  // 2.3: AI Copilot bảo vệ giới hạn độ dài câu hỏi
  const longPrompt = 'Tin tuyển dụng '.repeat(200); // > 2000 ký tự
  const aiLengthRes = await fetch(`${baseUrl}/api/ai/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: longPrompt })
  });
  assert.strictEqual(aiLengthRes.status, 400, 'Câu hỏi AI vượt quá 2000 ký tự phải trả về 400 Bad Request');
  console.log('✅ [2.3 PASS] AI Copilot chặn câu hỏi vượt quá 2.000 ký tự chống cạn kiệt quota');

  // 2.4: Admin bị chặn khi gửi đánh giá trực tiếp (403 Forbidden)
  const adminRatingRes = await fetch(`${baseUrl}/api/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      jobId: 'job-1',
      targetType: 'company',
      stars: 5,
      comment: 'Admin rating test'
    })
  });
  assert.strictEqual(adminRatingRes.status, 403, 'Quản trị viên gửi đánh giá phải bị 403 Forbidden');
  console.log('✅ [2.4 PASS] Quản trị viên bị chặn khi cố gửi đánh giá (403 Forbidden, chỉ người tham gia thật mới được đánh giá)');

  // 2.5: Employer không thể nhận cuốc gig (403 Forbidden - chỉ job_seeker)
  const createGigForRoleTest = await fetch(`${baseUrl}/api/gigs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({
      title: 'Cuốc test phân quyền nhận gig',
      reward: '50.000đ',
      rewardNum: 50000,
      cargoType: 'Tài liệu',
      sender: '0912345678',
      receiver: '0987654321',
      pickupLocation: { name: 'Điểm lấy', address: '123 Cầu Giấy', lat: 21.03, lng: 105.79 },
      dropoffLocation: { name: 'Điểm giao', address: '456 Ba Đình', lat: 21.04, lng: 105.82 }
    })
  });
  const gigRoleTestData = await createGigForRoleTest.json();
  const roleTestGigId = gigRoleTestData.gig?.id;

  // Đăng nhập 1 NTD khác để thử nhận cuốc
  const otherEmpLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@nextgentech.vn', password: '123456' })
  });
  const otherEmpToken = (await otherEmpLogin.json()).token;

  const empAcceptRes = await fetch(`${baseUrl}/api/gigs/${roleTestGigId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${otherEmpToken}` }
  });
  assert.strictEqual(empAcceptRes.status, 403, 'Tài khoản nhà tuyển dụng không được phép nhận cuốc gig (403)');
  console.log('✅ [2.5 PASS] Chặn tài khoản không phải Ứng viên (job_seeker) nhận cuốc việc vặt (HTTP 403)');

  // Dọn cuốc test
  if (roleTestGigId) {
    await fetch(`${baseUrl}/api/gigs/${roleTestGigId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${empToken}` }
    });
  }

  // 2.6: Tải CV có xác thực bảo mật (Chưa đăng nhập -> 401)
  const unauthCvRes = await fetch(`${baseUrl}/api/applications/app-test-random/cv`);
  assert.strictEqual(unauthCvRes.status, 401, 'Tải CV không có token phải bị 401 Unauthorized');
  console.log('✅ [2.6 PASS] Tải CV bắt buộc đăng nhập tài khoản hợp lệ (HTTP 401 khi thiếu token)');

  // 10.1: Xuất dữ liệu cá nhân theo chuẩn PDPA/GDPR (GET /api/users/me/export)
  const exportRes = await fetch(`${baseUrl}/api/users/me/export`, {
    headers: { 'Authorization': `Bearer ${seekerToken}` }
  });
  assert.strictEqual(exportRes.status, 200, 'GET /api/users/me/export phải trả về 200 OK');
  const exportData = await exportRes.json();
  assert.strictEqual(exportData.success, true, 'Export phải thành công');
  assert.ok(exportData.user, 'Phải có thông tin user');
  assert.strictEqual(exportData.user.password_hash, undefined, 'Tuyệt đối không rò rỉ password_hash');
  assert.ok(exportRes.headers.get('content-disposition')?.includes('worklink-user-data-export-'), 'Phải có header Content-Disposition tải file JSON');
  console.log('✅ [10.1 PASS] Xuất dữ liệu cá nhân (PDPA Export) thành công (JSON file download)');

  // 10.2: Xóa mềm tài khoản (DELETE /api/users/me) & xóa mềm toàn bộ CV, Job Apply
  const tempEmail = `pdpa_test_${Date.now()}@worklink.vn`;
  const tempReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tempEmail,
      password: 'SecurePassword123!',
      name: 'PDPA Test User',
      role: 'job_seeker'
    })
  });
  const tempRegData = await tempReg.json();
  const tempToken = tempRegData.token;
  const tempUserId = tempRegData.user?.id;

  const tempAppId = `app-pdpa-${Date.now()}`;
  await runSql(`INSERT INTO applications (id, job_id, user_id, applicant_name, phone, email) VALUES (?, 'job-1', ?, 'PDPA', '0912345678', ?)`, [tempAppId, tempUserId, tempEmail]);

  const tempCvaId = `cva-pdpa-${Date.now()}`;
  await runSql(`INSERT INTO cv_analyses (id, user_id, cv_name, ats_score) VALUES (?, ?, 'CV-Test.pdf', 80)`, [tempCvaId, tempUserId]);

  const tempMsgId = `msg-pdpa-${Date.now()}`;
  await runSql(`INSERT INTO chat_messages (id, thread_id, sender_id, sender_name, sender_role, text) VALUES (?, 'thread-pdpa-test', ?, 'Tên Ứng Viên Gốc', 'job_seeker', 'Tin nhắn thử nghiệm PDPA')`, [tempMsgId, tempUserId]);

  const uploadDir = path.join(process.cwd(), 'uploads', 'cv');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const testCvFilename = `cv-pdpa-${tempUserId}.pdf`;
  const testCvPath = path.join(uploadDir, testCvFilename);
  fs.writeFileSync(testCvPath, 'dummy cv file content for pdpa deletion verification');
  await runSql('UPDATE applications SET cv_file_path = ? WHERE id = ?', [testCvFilename, tempAppId]);

  const deleteMeRes = await fetch(`${baseUrl}/api/users/me`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tempToken}` }
  });
  assert.strictEqual(deleteMeRes.status, 200, 'DELETE /api/users/me phải trả về 200');
  const deleteMeData = await deleteMeRes.json();
  assert.strictEqual(deleteMeData.success, true);

  const deletedUserRow = await getSql('SELECT deleted_at FROM users WHERE id = ?', [tempUserId]);
  assert.ok(deletedUserRow?.deleted_at, 'User phải được gắn deleted_at');

  const deletedAppRow = await getSql('SELECT deleted_at FROM applications WHERE id = ?', [tempAppId]);
  assert.ok(deletedAppRow?.deleted_at, 'Application phải được gắn deleted_at');

  const deletedCvaRow = await getSql('SELECT deleted_at FROM cv_analyses WHERE id = ?', [tempCvaId]);
  assert.ok(deletedCvaRow?.deleted_at, 'CV Analysis phải được gắn deleted_at');

  // Kiểm tra ẩn danh tin nhắn Chat
  const anonymizedMsg = await getSql('SELECT sender_name FROM chat_messages WHERE id = ?', [tempMsgId]);
  assert.strictEqual(anonymizedMsg?.sender_name, '[Tài khoản đã xóa]', 'Tin nhắn Chat của user sau khi xóa mềm phải chuyển thành [Tài khoản đã xóa]');

  // Kiểm tra xóa vật lý file CV trên ổ cứng
  assert.strictEqual(fs.existsSync(testCvPath), false, 'File CV vật lý trên ổ đĩa phải được xóa sạch hoàn toàn');

  // Kiểm tra Audit Log lưu vào CSDL bảng audit_logs
  const userDeleteAudit = await getSql("SELECT * FROM audit_logs WHERE target_id = ? AND action = 'USER_ACCOUNT_SOFT_DELETE'", [tempUserId]);
  assert.ok(userDeleteAudit, 'Hành động Soft Delete phải được lưu vào CSDL bảng audit_logs');

  const reloginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: tempEmail, password: 'SecurePassword123!' })
  });
  assert.strictEqual(reloginRes.status, 401, 'Tài khoản đã Soft Delete không thể đăng nhập');
  console.log('✅ [10.2 PASS] Xóa mềm tài khoản (Soft Delete) & ẩn danh chat, xóa vật lý file CV, lưu audit log CSDL');

  // 10.3: Quản trị AI Quota & Cron Job Reset về 5
  const quotaEmail = `quota_test_${Date.now()}@worklink.vn`;
  const quotaReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: quotaEmail,
      password: 'SecurePassword123!',
      name: 'Quota Test User',
      role: 'job_seeker'
    })
  });
  const quotaRegData = await quotaReg.json();
  const quotaToken = quotaRegData.token;
  const quotaUserId = quotaRegData.user?.id;

  // 10.3.1: Admin được bỏ qua kiểm tra hạn mức Quota (kể cả khi ai_quota = 0)
  await runSql("UPDATE users SET ai_quota = 0 WHERE email = 'admin@worklink.vn'");
  const adminBypassRes = await fetch(`${baseUrl}/api/cv/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ cvText: 'Admin kiểm tra quét CV không bị giới hạn hạn mức' })
  });
  assert.strictEqual(adminBypassRes.status, 200, 'Quản trị viên phải được bỏ qua kiểm tra hạn mức AI Quota');

  // 10.3.2: Ứng viên khi hết quota (ai_quota = 0) bị chặn 403 Forbidden
  const { resetMonthlyAiQuota } = await import('../server/services/aiQuotaCron.js');
  await runSql('UPDATE users SET ai_quota = 0 WHERE id = ?', [quotaUserId]);

  const quotaBlockedRes = await fetch(`${baseUrl}/api/cv/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${quotaToken}`
    },
    body: JSON.stringify({ cvText: 'Kỹ năng: React, Node.js, PostgreSQL' })
  });
  assert.strictEqual(quotaBlockedRes.status, 403, 'Hết quota phải trả về 403 Forbidden');
  const quotaBlockedData = await quotaBlockedRes.json();
  assert.strictEqual(quotaBlockedData.code, 'AI_QUOTA_EXCEEDED');

  // 10.3.3: Cron Job reset quota với Distributed Lock
  const cronResult = await resetMonthlyAiQuota({ useLock: true });
  assert.strictEqual(cronResult.success, true, 'Cron reset quota với Redis Distributed Lock phải thành công');

  const resetUserRow = await getSql('SELECT ai_quota FROM users WHERE id = ?', [quotaUserId]);
  assert.strictEqual(resetUserRow.ai_quota, 5, 'AI Quota phải được reset về 5');

  // 10.3.4: Quota chỉ trừ SAU KHI phân tích CV thành công
  const quotaSuccessRes = await fetch(`${baseUrl}/api/cv/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${quotaToken}`
    },
    body: JSON.stringify({ cvText: 'Kỹ năng: React, Node.js, PostgreSQL' })
  });
  assert.strictEqual(quotaSuccessRes.status, 200, 'Sau khi reset quota phải phân tích thành công');
  const afterUserRow = await getSql('SELECT ai_quota FROM users WHERE id = ?', [quotaUserId]);
  assert.strictEqual(afterUserRow.ai_quota, 4, 'Quota phải bị trừ đi 1 sau khi chạy thành công');
  console.log('✅ [10.3 PASS] Quản trị AI Quota: Admin bypass, trừ quota sau phân tích, và Cron Distributed Lock');

  // 11.1: Quản trị viên Kiểm duyệt Tin Tuyển Dụng (Job Moderation PUT /api/admin/jobs/:id/status)
  const testJobId = `job-mod-test-${Date.now()}`;
  await runSql(`
    INSERT INTO jobs (id, employer_id, title, company, category, district, salary_display, status, moderation_status)
    VALUES (?, 'user-employer-1', 'Lập trình viên Node.js & React', 'WorkLink Inc', 'IT', 'Cầu Giấy', '15.000.000 đ', 'pending', 'pending')
  `, [testJobId]);

  // 1. Chặn request không có token (401 Unauthorized)
  const noAuthModRes = await fetch(`${baseUrl}/api/admin/jobs/${testJobId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' })
  });
  assert.strictEqual(noAuthModRes.status, 401, 'PUT moderation không có token phải trả về 401 Unauthorized');

  // 2. Chặn vai trò không phải Admin (403 Forbidden)
  const nonAdminModRes = await fetch(`${baseUrl}/api/admin/jobs/${testJobId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    },
    body: JSON.stringify({ status: 'active' })
  });
  assert.strictEqual(nonAdminModRes.status, 403, 'Người dùng không phải Admin phải bị 403 Forbidden');

  // 3. Chặn status bừa bãi không nằm trong Whitelist (400 Bad Request)
  const invalidStatusRes = await fetch(`${baseUrl}/api/admin/jobs/${testJobId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'super_approved_hack' })
  });
  assert.strictEqual(invalidStatusRes.status, 400, 'Status không nằm trong whitelist phải bị 400 Bad Request');

  // 4. Chặn State Transition không hợp lệ (ví dụ: pending -> expired)
  const invalidTransRes = await fetch(`${baseUrl}/api/admin/jobs/${testJobId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'expired' })
  });
  assert.strictEqual(invalidTransRes.status, 400, 'Chuyển đổi trạng thái bất hợp lệ phải bị 400 Bad Request');

  // 5. Quản trị viên duyệt tin thành công (pending -> active)
  const approveModRes = await fetch(`${baseUrl}/api/admin/jobs/${testJobId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'active', reason: 'Nội dung tin tuyển dụng hợp lệ, đúng chính sách' })
  });
  assert.strictEqual(approveModRes.status, 200, 'Admin duyệt tin thành công phải trả về 200 OK');
  const approvedJobData = await approveModRes.json();
  assert.strictEqual(approvedJobData.success, true);
  assert.strictEqual(approvedJobData.job.status, 'active');
  assert.strictEqual(approvedJobData.job.moderationStatus, 'approved');

  const dbJobAfterMod = await getSql('SELECT status, moderation_status FROM jobs WHERE id = ?', [testJobId]);
  assert.strictEqual(dbJobAfterMod.status, 'active', 'Trạng thái job trong DB phải là active');
  assert.strictEqual(dbJobAfterMod.moderation_status, 'approved', 'moderation_status trong DB phải là approved');
  console.log('✅ [11.1 PASS] Job Moderation API: Kiểm soát quyền Admin, whitelist status, transition matrix và duyệt tin');

  // 11.2: Hệ thống Audit Logger: Lưu vết vào CSDL bảng audit_logs & API xem lịch sử kiểm toán
  const auditLogRow = await getSql(`SELECT * FROM audit_logs WHERE target_id = ? AND action = 'ADMIN_JOB_MODERATION'`, [testJobId]);
  assert.ok(auditLogRow, 'Thao tác kiểm duyệt phải được ghi nhận vào bảng audit_logs');
  assert.strictEqual(auditLogRow.action, 'ADMIN_JOB_MODERATION');
  assert.ok(auditLogRow.admin_id, 'Phải có admin_id người thực hiện');
  assert.ok(auditLogRow.ip_address, 'Phải ghi nhận IP người gửi');
  assert.ok(auditLogRow.details, 'Phải lưu trữ chi tiết thay đổi (JSON)');

  const getAuditListRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(getAuditListRes.status, 200, 'GET /api/admin/audit-logs phải trả về 200 OK');
  const auditListData = await getAuditListRes.json();
  assert.ok(Array.isArray(auditListData.auditLogs), 'Danh sách audit logs phải là mảng');
  assert.ok(auditListData.auditLogs.some(l => l.target_id === testJobId), 'Audit list phải chứa sự kiện vừa tạo');
  console.log('✅ [11.2 PASS] Audit Logger: Ghi nhận CSDL bảng audit_logs chi tiết (admin_id, action, target_id, details JSON, IP) và truy vấn thành công');

  // Dọn dẹp tài khoản & dữ liệu test
  await runSql('DELETE FROM audit_logs WHERE target_id IN (?, ?)', [testJobId, tempUserId]).catch(() => {});
  await runSql('DELETE FROM jobs WHERE id = ?', [testJobId]).catch(() => {});
  await runSql('DELETE FROM chat_messages WHERE id = ?', [tempMsgId]).catch(() => {});
  await runSql('DELETE FROM applications WHERE user_id IN (?, ?)', [tempUserId, quotaUserId]).catch(() => {});
  await runSql('DELETE FROM cv_analyses WHERE user_id IN (?, ?)', [tempUserId, quotaUserId]).catch(() => {});
  await runSql('DELETE FROM users WHERE id IN (?, ?)', [tempUserId, quotaUserId]).catch(() => {});

}

if (process.argv[1] && process.argv[1].includes('new_audit_fixes.test.js')) {
  runAuditFixesTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}
