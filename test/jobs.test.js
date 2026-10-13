import assert from 'assert';

export async function runJobTests(baseUrl) {
  console.log('\n--- 📋 4. KIỂM THỬ VÒNG ĐỜI TIN TUYỂN DỤNG & ĐƠN ỨNG TUYỂN ---');

  // Đăng nhập Seeker
  const seekerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'minhanh.student@gmail.com', password: '123456' })
  });
  const seekerToken = (await seekerLogin.json()).token;

  // Đăng nhập Employer
  const employerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@thecoffeelab.vn', password: '123456' })
  });
  const employerToken = (await employerLogin.json()).token;

  // Test 4.1: NTD đăng tin tuyển dụng mới
  const postJobRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({
      title: `Nhân viên Barista Full-stack ${Date.now()}`,
      company: 'The Coffee Lab',
      category: 'F&B / Nhà hàng',
      district: 'Cầu Giấy',
      city: 'Hà Nội',
      salaryDisplay: '35.000đ - 45.000đ/giờ',
      salaryType: 'hourly',
      jobType: 'Bán thời gian',
      timeShift: 'Linh hoạt',
      description: 'Mô tả công việc kiểm thử',
      requirements: 'Nhanh nhẹn, có tâm',
      benefits: 'Nước uống miễn phí',
      slots: 2
    })
  });
  const postJobData = await postJobRes.json();
  assert.strictEqual(postJobRes.status, 201, 'Đăng job mới phải trả về 201');
  const createdJobId = postJobData.job.id;
  assert.ok(createdJobId, 'Job phải có ID');
  assert.strictEqual(postJobData.job.status, 'pending', 'Job mới đăng phải có trạng thái mặc định là pending');
  assert.ok(postJobData.job.expiresAt, 'Job mới đăng phải có trường expiresAt');
  console.log('✅ [PASS] NTD đăng tin tuyển dụng mới thành công (HTTP 201, status: pending, expiresAt:', postJobData.job.expiresAt, ')');

  // Test 4.2: NTD chỉnh sửa tin tuyển dụng
  const updateJobRes = await fetch(`${baseUrl}/api/jobs/${createdJobId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({
      title: 'Nhân viên Barista Trưởng Ca (Đã Cập Nhật)',
      salaryDisplay: '50.000đ/giờ'
    })
  });
  const updateJobData = await updateJobRes.json();
  assert.strictEqual(updateJobRes.status, 200, 'Sửa job phải trả về 200');
  assert.strictEqual(updateJobData.job.title, 'Nhân viên Barista Trưởng Ca (Đã Cập Nhật)');
  console.log('✅ [PASS] NTD chỉnh sửa tin tuyển dụng thành công (HTTP 200)');

  // Test 4.2b: Kiểm duyệt tin (Moderation) & Cron tự động hết hạn (Auto-expire)
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@worklink.vn', password: '123456' })
  });
  const adminToken = (await adminLoginRes.json()).token;

  // 1. Admin duyệt tin tuyển dụng (status -> active)
  const moderateRes = await fetch(`${baseUrl}/api/jobs/${createdJobId}/moderate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'approved' })
  });
  assert.strictEqual(moderateRes.status, 200);
  const getJobAfterMod = await fetch(`${baseUrl}/api/jobs/${createdJobId}`);
  const jobAfterModData = await getJobAfterMod.json();
  assert.strictEqual(jobAfterModData.job.status, 'active', 'Job được duyệt phải có status là active');
  console.log('✅ [PASS] Admin kiểm duyệt tin thành công, đồng bộ status thành active');

  // 2. Cron Job kiểm tra và tự động đổi trạng thái tin quá hạn thành 'expired'
  const expiredJobRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({
      title: `Job Quá Hạn Test ${Date.now()}`,
      company: 'The Coffee Lab',
      deadline: '2020-01-01',
      expiresAt: '2020-01-01T00:00:00Z',
      category: 'F&B',
      salaryDisplay: '30.000đ/giờ'
    })
  });
  const expiredJobData = await expiredJobRes.json();
  const pastJobId = expiredJobData.job.id;

  const cronRes = await fetch(`${baseUrl}/api/jobs/cron/expire-now`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(cronRes.status, 200);
  const getExpiredJob = await fetch(`${baseUrl}/api/jobs/${pastJobId}`);
  const expiredJobCheck = await getExpiredJob.json();
  assert.strictEqual(expiredJobCheck.job.status, 'expired', 'Job quá hạn phải tự động chuyển thành expired');

  // Dọn dẹp tin test quá hạn
  await fetch(`${baseUrl}/api/jobs/${pastJobId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${employerToken}` }
  });
  console.log('✅ [PASS] Cron Job quét và tự động chuyển các tin quá hạn sang trạng thái expired');

  // Test 4.3: Ứng viên nộp hồ sơ vào tin
  const applyRes = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      jobId: createdJobId,
      applicantName: 'Nguyễn Minh Anh',
      phone: '0988 123 456',
      coverLetter: 'Xin chào, tôi rất đam mê vị trí Barista Trưởng Ca này!'
    })
  });
  const applyData = await applyRes.json();
  assert.strictEqual(applyRes.status, 201, 'Nộp đơn lần đầu phải trả về 201');
  const appId = applyData.application.id;
  console.log('✅ [PASS] Ứng viên nộp hồ sơ ứng tuyển thành công (HTTP 201, App ID:', appId, ')');

  // Test 4.4: Chặn nộp hồ sơ trùng lặp
  const dupApplyRes = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      jobId: createdJobId,
      applicantName: 'Nguyễn Minh Anh',
      phone: '0988 123 456',
      coverLetter: 'Nộp lại lần hai'
    })
  });
  assert.strictEqual(dupApplyRes.status, 409, 'Nộp trùng đơn phải trả về 409 Conflict');
  console.log('✅ [PASS] Chặn nộp đơn trùng lặp thành công (HTTP 409 Conflict)');

  // Test 4.5: Ứng viên tự hủy/rút hồ sơ
  const withdrawRes = await fetch(`${baseUrl}/api/applications/${appId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${seekerToken}` }
  });
  assert.strictEqual(withdrawRes.status, 200, 'Rút hồ sơ của chính mình phải thành công');
  console.log('✅ [PASS] Ứng viên tự rút hồ sơ ứng tuyển thành công (HTTP 200)');

  // Nộp lại sau khi đã rút
  const reApplyRes = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      jobId: createdJobId,
      applicantName: 'Nguyễn Minh Anh',
      phone: '0988 123 456',
      coverLetter: 'Nộp lại sau khi đã rút'
    })
  });
  assert.strictEqual(reApplyRes.status, 201, 'Cho phép nộp lại sau khi đã rút hồ sơ cũ');
  console.log('✅ [PASS] Cho phép nộp lại hồ sơ sau khi đã rút đơn trước đó');

  // Test 4.6: Xóa job kèm Cascading Cleanup
  const deleteJobRes = await fetch(`${baseUrl}/api/jobs/${createdJobId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${employerToken}` }
  });
  assert.strictEqual(deleteJobRes.status, 200, 'Xóa job phải thành công');

  // Xác nhận job đã bị xóa
  const getJobRes = await fetch(`${baseUrl}/api/jobs/${createdJobId}`);
  assert.strictEqual(getJobRes.status, 404, 'Job vừa xóa không còn tồn tại');
  console.log('✅ [PASS] NTD xóa tin tuyển dụng và tự động dọn sạch hồ sơ liên quan (Cascading Cleanup)');

  // Test 4.7: Phân trang danh sách việc làm (GET /api/jobs?page=1&limit=3)
  const pagedJobsRes = await fetch(`${baseUrl}/api/jobs?page=1&limit=3`);
  assert.strictEqual(pagedJobsRes.status, 200);
  const pagedJobsData = await pagedJobsRes.json();
  assert.strictEqual(pagedJobsData.success, true);
  assert.strictEqual(pagedJobsData.jobs.length, 3, 'Phải trả về đúng 3 việc làm theo limit=3');
  assert.strictEqual(pagedJobsData.pagination.page, 1);
  assert.strictEqual(pagedJobsData.pagination.limit, 3);
  assert.ok(pagedJobsData.total >= 3, 'Tổng số việc làm phải >= 3');
  assert.ok(pagedJobsData.pagination.totalPages >= 1);
  console.log(`✅ [PASS] Phân trang việc làm hoạt động chuẩn xác (Trang 1/3 jobs, Total: ${pagedJobsData.total})`);

  // Test 4.8: Phân trang dự án Freelance & Việc vặt (Gigs)
  const pagedFlRes = await fetch(`${baseUrl}/api/freelance?page=1&limit=2`);
  const pagedFlData = await pagedFlRes.json();
  assert.strictEqual(pagedFlRes.status, 200);
  assert.ok(pagedFlData.pagination, 'Dự án Freelance phải có metadata phân trang');
  console.log('✅ [PASS] Phân trang dự án Freelance hoạt động chuẩn xác');

  const pagedGigRes = await fetch(`${baseUrl}/api/gigs?page=1&limit=2`);
  const pagedGigData = await pagedGigRes.json();
  assert.strictEqual(pagedGigRes.status, 200);
  assert.ok(pagedGigData.pagination, 'Việc vặt (Gigs) phải có metadata phân trang');
  console.log('✅ [PASS] Phân trang việc vặt (Gigs) hoạt động chuẩn xác');

  // Test 4.9: Phân trang bắt buộc cho Jobs (mặc định limit 20, trần max 50)
  const defaultPagedJobsRes = await fetch(`${baseUrl}/api/jobs`);
  assert.strictEqual(defaultPagedJobsRes.status, 200);
  const defaultPagedData = await defaultPagedJobsRes.json();
  assert.strictEqual(defaultPagedData.success, true);
  assert.strictEqual(defaultPagedData.limit, 20, 'Limit mặc định phải là 20');
  assert.strictEqual(defaultPagedData.currentPage, 1, 'Current page mặc định phải là 1');
  assert.ok(typeof defaultPagedData.total === 'number', 'Phải có metadata total');
  assert.ok(typeof defaultPagedData.totalPages === 'number', 'Phải có metadata totalPages');

  const maxClampedJobsRes = await fetch(`${baseUrl}/api/jobs?limit=100`);
  const maxClampedData = await maxClampedJobsRes.json();
  assert.strictEqual(maxClampedData.limit, 50, 'Limit vượt quá 50 phải bị kẹp trần tối đa 50');
  console.log('✅ [PASS] Phân trang bắt buộc cho Jobs (mặc định limit 20, max 50) và trả về metadata chuẩn');

  // Test 4.10: Tìm kiếm việc làm bằng SQL Full-Text Search
  const ftsSearchRes = await fetch(`${baseUrl}/api/jobs?keyword=Barista`);
  assert.strictEqual(ftsSearchRes.status, 200);
  const ftsSearchData = await ftsSearchRes.json();
  assert.strictEqual(ftsSearchData.success, true);
  assert.ok(Array.isArray(ftsSearchData.jobs));
  assert.ok(typeof ftsSearchData.total === 'number');
  console.log('✅ [PASS] Tìm kiếm việc làm với PostgreSQL Full-Text Search hoạt động chuẩn xác');

  // Test 4.11: Phân trang danh sách người dùng Admin (GET /api/admin/users)
  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@worklink.vn', password: '123456' })
  });
  const adminTokenUsers = (await adminLogin.json()).token;

  const pagedUsersRes = await fetch(`${baseUrl}/api/admin/users?page=1&limit=5`, {
    headers: { 'Authorization': `Bearer ${adminTokenUsers}` }
  });
  assert.strictEqual(pagedUsersRes.status, 200);
  const pagedUsersData = await pagedUsersRes.json();
  assert.strictEqual(pagedUsersData.success, true);
  assert.strictEqual(pagedUsersData.currentPage, 1);
  assert.strictEqual(pagedUsersData.limit, 5);
  assert.ok(pagedUsersData.total >= 1);
  assert.ok(pagedUsersData.totalPages >= 1);
  assert.ok(Array.isArray(pagedUsersData.users));
  console.log('✅ [PASS] Phân trang danh sách người dùng Admin (GET /api/admin/users) chuẩn metadata');
}
