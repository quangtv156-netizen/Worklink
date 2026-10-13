import assert from 'assert';

export async function runRBACTests(baseUrl) {
  console.log('\n--- 🔒 3. KIỂM THỬ PHÂN QUYỀN VAI TRÒ (RBAC) & BẢO MẬT DỮ LIỆU ---');

  // Đăng nhập Seeker
  const seekerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'minhanh.student@gmail.com', password: '123456' })
  });
  const seekerData = await seekerLogin.json();
  const seekerToken = seekerData.token;
  assert.ok(seekerToken, 'Phải đăng nhập được tài khoản Seeker');

  // Đăng nhập Employer
  const employerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@thecoffeelab.vn', password: '123456' })
  });
  const employerData = await employerLogin.json();
  const employerToken = employerData.token;
  assert.ok(employerToken, 'Phải đăng nhập được tài khoản Employer');

  // Đăng nhập Admin
  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@worklink.vn', password: '123456' })
  });
  const adminData = await adminLogin.json();
  const adminToken = adminData.token;
  assert.ok(adminToken, 'Phải đăng nhập được tài khoản Admin');

  // Test 3.1: Ứng viên không được phép đăng việc làm (POST /api/jobs)
  const seekerPostJobRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      title: 'Công việc vi phạm quyền',
      category: 'Phục vụ',
      district: 'Cầu Giấy'
    })
  });
  assert.strictEqual(seekerPostJobRes.status, 403, 'Ứng viên đăng job phải bị từ chối 403 Forbidden');
  console.log('✅ [PASS] Ứng viên bị chặn khi cố tình đăng tin tuyển dụng (HTTP 403 Forbidden)');

  // Test 3.2: Ứng viên không được phép đăng dự án Freelance (POST /api/freelance)
  const seekerPostFreelanceRes = await fetch(`${baseUrl}/api/freelance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      title: 'Dự án Freelance trái phép',
      budget: '5.000.000đ'
    })
  });
  assert.strictEqual(seekerPostFreelanceRes.status, 403, 'Ứng viên đăng freelance project phải bị 403 Forbidden');
  console.log('✅ [PASS] Ứng viên bị chặn khi cố tình đăng dự án Freelance (HTTP 403 Forbidden)');

  // Test 3.3: Nhà tuyển dụng không được nộp hồ sơ xin việc (POST /api/applications)
  const employerApplyRes = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({
      jobId: 'job-1',
      applicantName: 'NTD Tự Ứng Tuyển',
      phone: '0912345678',
      coverLetter: 'Tôi là NTD muốn xin việc'
    })
  });
  assert.strictEqual(employerApplyRes.status, 403, 'NTD nộp hồ sơ phải bị 403 Forbidden');
  console.log('✅ [PASS] Nhà tuyển dụng bị chặn khi nộp hồ sơ ứng tuyển (HTTP 403 Forbidden)');

  // Test 3.4: Chống lộ giá thầu Freelance giữa các ứng viên đối thủ
  // Tạo một dự án Freelance bởi Employer
  const createProjRes = await fetch(`${baseUrl}/api/freelance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({
      title: `Freelance RBAC Test ${Date.now()}`,
      client: 'The Coffee Lab',
      budget: '8.000.000đ',
      category: 'Design',
      deadline: '7 ngày',
      description: 'Mô tả dự án bảo mật'
    })
  });
  const projData = await createProjRes.json();
  const projectId = projData.project.id;

  // Seeker nộp đề xuất (bid: 7.500.000đ)
  await fetch(`${baseUrl}/api/freelance/${projectId}/proposals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      bid: '7.500.000đ',
      duration: '5 ngày',
      cover: 'Thư chào thầu bí mật của Seeker 1'
    })
  });

  // Tạo thêm một Seeker đối thủ
  const rivalEmail = `rival_${Date.now()}@worklink.vn`;
  const rivalReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rival Freelancer',
      email: rivalEmail,
      password: 'RivalPassword123!',
      role: 'job_seeker'
    })
  });
  const rivalRegData = await rivalReg.json();
  const rivalToken = rivalRegData.token;
  const rivalUserId = rivalRegData.user?.id;

  // Đối thủ xem proposals của dự án này -> Không được thấy proposal của Seeker 1
  const rivalViewRes = await fetch(`${baseUrl}/api/freelance/${projectId}/proposals`, {
    headers: { 'Authorization': `Bearer ${rivalToken}` }
  });
  const rivalViewData = await rivalViewRes.json();
  assert.strictEqual(rivalViewRes.status, 200);
  assert.strictEqual(rivalViewData.proposals.length, 0, 'Đối thủ chưa nộp đề xuất thì danh sách phải rỗng');
  console.log('✅ [PASS] Bảo mật đề xuất: Freelancer đối thủ hoàn toàn KHÔNG xem được giá thầu của người khác');

  // Chủ sở hữu (Employer) xem proposals -> Nhìn thấy đầy đủ đề xuất
  const ownerViewRes = await fetch(`${baseUrl}/api/freelance/${projectId}/proposals`, {
    headers: { 'Authorization': `Bearer ${employerToken}` }
  });
  const ownerViewData = await ownerViewRes.json();
  assert.strictEqual(ownerViewRes.status, 200);
  assert.strictEqual(ownerViewData.proposals.length, 1, 'Chủ dự án phải nhìn thấy 1 đề xuất');
  assert.strictEqual(ownerViewData.proposals[0].bid, '7.500.000đ', 'Giá thầu hiển thị chính xác cho chủ dự án');
  console.log('✅ [PASS] Chủ sở hữu dự án xem đầy đủ chi tiết mọi đề xuất chào thầu hợp lệ');

  // Test 3.4b: Whitelist trạng thái dự án Freelance (PUT /api/freelance/:id)
  const invalidStatusRes = await fetch(`${baseUrl}/api/freelance/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({ status: 'INVALID_STATUS_HACK' })
  });
  assert.strictEqual(invalidStatusRes.status, 400, 'Cập nhật status freelance không thuộc whitelist phải bị 400 Bad Request');
  console.log('✅ [PASS] Whitelist trạng thái Freelance: Chặn status không hợp lệ (HTTP 400 Bad Request)');

  const validStatusRes = await fetch(`${baseUrl}/api/freelance/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });
  assert.strictEqual(validStatusRes.status, 200, 'Cập nhật status freelance hợp lệ phải trả về 200');
  console.log('✅ [PASS] Whitelist trạng thái Freelance: Cập nhật status hợp lệ thành công');

  // Test 3.5: Chặn Admin tự hạ quyền của chính mình
  const adminSelfDemoteRes = await fetch(`${baseUrl}/api/admin/users/user-admin-1/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ role: 'job_seeker' })
  });
  assert.strictEqual(adminSelfDemoteRes.status, 400, 'Không được phép tự hạ quyền của mình');
  console.log('✅ [PASS] Chặn Quản trị viên tự hạ quyền của chính mình (HTTP 400 Bad Request)');

  // Test 3.6: Ứng viên không được phép đăng việc vặt (POST /api/gigs)
  const seekerPostGigRes = await fetch(`${baseUrl}/api/gigs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seekerToken}`
    },
    body: JSON.stringify({
      title: 'Việc vặt trái phép',
      reward: '50.000đ',
      rewardNum: 50000
    })
  });
  assert.strictEqual(seekerPostGigRes.status, 403, 'Ứng viên đăng gig phải bị 403 Forbidden');
  console.log('✅ [PASS] Ứng viên bị chặn khi cố tình đăng việc vặt (HTTP 403 Forbidden)');

  // Test 3.7: Nhà tuyển dụng đăng việc vặt mới thành công
  const empPostGigRes = await fetch(`${baseUrl}/api/gigs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employerToken}`
    },
    body: JSON.stringify({
      title: `Việc vặt RBAC Test ${Date.now()}`,
      reward: '60.000đ',
      rewardNum: 60000,
      cargoType: 'Tài liệu mật',
      pickup: { address: 'Trần Thái Tông', lat: 21.03, lng: 105.78 },
      dropoff: { address: 'Duy Tân', lat: 21.032, lng: 105.782 },
      distanceKm: 0.8
    })
  });
  assert.strictEqual(empPostGigRes.status, 201, 'NTD đăng gig mới phải trả về 201');
  const gigData = await empPostGigRes.json();
  const createdGigId = gigData.gig.id;
  assert.ok(createdGigId, 'Gig phải có ID');
  console.log('✅ [PASS] NTD đăng việc vặt thành công (HTTP 201, ID:', createdGigId, ')');

  // Test 3.8: Ứng viên không được phép xoá việc vặt của NTD
  const seekerDelGigRes = await fetch(`${baseUrl}/api/gigs/${createdGigId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${seekerToken}` }
  });
  assert.strictEqual(seekerDelGigRes.status, 403, 'Ứng viên không được xoá gig của NTD (403)');
  console.log('✅ [PASS] Ứng viên bị chặn khi cố tình xoá việc vặt của người khác (HTTP 403)');

  // Test 3.9: NTD xoá việc vặt của mình thành công
  const empDelGigRes = await fetch(`${baseUrl}/api/gigs/${createdGigId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${employerToken}` }
  });
  assert.strictEqual(empDelGigRes.status, 200, 'NTD xoá gig của mình phải thành công (200)');
  console.log('✅ [PASS] NTD tự xoá việc vặt của mình thành công (HTTP 200)');

  // Test 3.10: CLEANUP - Dọn dẹp chính xác các bản ghi do test tạo ra
  // Xoá freelance project tạo ở Test 3.4
  const delProjRes = await fetch(`${baseUrl}/api/freelance/${projectId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${employerToken}` }
  });
  assert.strictEqual(delProjRes.status, 200, 'Xoá dự án freelance test phải thành công');

  // Xoá user rival tạo ở Test 3.4
  if (rivalUserId) {
    const delRivalRes = await fetch(`${baseUrl}/api/admin/users/${rivalUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delRivalRes.status, 200, 'Admin xoá tài khoản rival test thành công');
  }

  console.log('🧹 [CLEANUP] Đã dọn sạch 100% dữ liệu tạm do RBAC Test tạo ra (project ID:', projectId, ')');
}
