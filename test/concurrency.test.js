import assert from 'assert';

/**
 * Suite riêng: kiểm thử ĐUA ĐIỀU KIỆN (race condition) bằng request đồng thời thật
 * (Promise.all), khác với các suite khác vốn chỉ test tuần tự từng bước.
 *
 * Đây là bộ test hồi quy cho lỗi đã từng gặp: "2 người nhận cùng 1 gig cùng lúc"
 * — nơi SELECT-rồi-UPDATE không atomic đã từng cho cả 2 request cùng "thắng".
 */
export async function runConcurrencyTests(baseUrl) {
  console.log('\n--- ⚡ 6. KIỂM THỬ ĐUA ĐIỀU KIỆN (RACE CONDITION) VỚI REQUEST ĐỒNG THỜI THẬT ---');

  // Đăng nhập Employer (chủ) & Admin (dọn dẹp)
  const employerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@thecoffeelab.vn', password: '123456' })
  });
  const { token: employerToken } = await employerLogin.json();
  assert.ok(employerToken, 'Phải đăng nhập được Employer');

  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@worklink.vn', password: '123456' })
  });
  const { token: adminToken } = await adminLogin.json();
  assert.ok(adminToken, 'Phải đăng nhập được Admin');

  // Tạo 2 tài khoản ứng viên "đối thủ" để tranh nhau 1 cuốc gig
  const suffix = Date.now();
  async function createSeeker(idx) {
    const email = `race.seeker.${suffix}.${idx}@test.worklink.vn`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Race Seeker ${idx}`,
        email,
        password: 'Password123!',
        role: 'job_seeker'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Tạo tài khoản đua tranh #${idx} phải thành công`);
    return { id: data.user.id, token: data.token, email };
  }

  const [seekerA, seekerB] = await Promise.all([createSeeker('A'), createSeeker('B')]);

  // ── Test 6.1: Đua nhau NHẬN 1 GIG — chỉ đúng 1 người được thắng ──────────
  const createGigRes = await fetch(`${baseUrl}/api/gigs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employerToken}` },
    body: JSON.stringify({
      title: `[RACE TEST ${suffix}] Giao tài liệu gấp`,
      reward: '50.000đ',
      rewardNum: 50000,
      cargoType: 'Tài liệu',
      pickup: { name: 'Văn phòng A', address: 'Văn phòng A', lat: 21.0368, lng: 105.7827 },
      dropoff: { name: 'Văn phòng B', address: 'Văn phòng B', lat: 21.0245, lng: 105.8412 },
      time: 'Trong 2 giờ'
    })
  });
  const gigData = await createGigRes.json();
  assert.strictEqual(createGigRes.status, 201, 'Tạo gig test phải thành công');
  const gigId = gigData.gig.id;

  // Bắn 2 request /accept GẦN NHƯ ĐỒNG THỜI bằng Promise.all (không await tuần tự)
  const [resA, resB] = await Promise.all([
    fetch(`${baseUrl}/api/gigs/${gigId}/accept`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${seekerA.token}` }
    }),
    fetch(`${baseUrl}/api/gigs/${gigId}/accept`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${seekerB.token}` }
    })
  ]);

  const statuses = [resA.status, resB.status].sort();
  // Đúng 1 trong 2 phải là 200 (thắng), người còn lại phải là 409 (đã có người nhận)
  assert.deepStrictEqual(
    statuses,
    [200, 409],
    `Phải có đúng 1 request thành công (200) và 1 request bị từ chối (409) — nhận được: [${statuses.join(', ')}]`
  );
  console.log('✅ [6.1 PASS] 2 request nhận gig đồng thời: chỉ đúng 1 người thắng (200), người còn lại bị chặn (409)');

  // Xác minh trong DB: gig chỉ có đúng 1 accepted_by, không bị người đến sau ghi đè
  const verifyRes = await fetch(`${baseUrl}/api/gigs`);
  const verifyData = await verifyRes.json();
  const finalGig = (verifyData.gigs || verifyData).find(g => g.id === gigId);
  assert.ok(finalGig, 'Gig phải còn tồn tại sau test');
  assert.strictEqual(finalGig.status, 'ACCEPTED', 'Gig phải chuyển đúng trạng thái ACCEPTED');
  const winnerId = resA.status === 200 ? seekerA.id : seekerB.id;
  assert.strictEqual(finalGig.acceptedBy || finalGig.accepted_by, winnerId, 'accepted_by phải khớp đúng người thắng request, không bị ghi đè bởi người thua');
  console.log('✅ [6.1 PASS] Dữ liệu DB nhất quán: accepted_by khớp đúng người thắng, không bị ghi đè');

  // ── Test 6.2: Đua nhau ỨNG TUYỂN TRÙNG cùng 1 job bằng cùng 1 tài khoản ──
  const dupSuffix = Date.now();
  const [appRes1, appRes2] = await Promise.all([
    fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${seekerA.token}` },
      body: JSON.stringify({ jobId: 'job-3', applicantName: 'Race Seeker A', phone: '0900000001', note: `Dup race ${dupSuffix}` })
    }),
    fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${seekerA.token}` },
      body: JSON.stringify({ jobId: 'job-3', applicantName: 'Race Seeker A', phone: '0900000001', note: `Dup race ${dupSuffix}` })
    })
  ]);
  const appStatuses = [appRes1.status, appRes2.status].sort();
  assert.ok(
    appStatuses[0] === 201 || appStatuses[0] === 409,
    `Ít nhất 1 trong 2 request ứng tuyển trùng đồng thời phải bị từ chối — nhận được: [${appStatuses.join(', ')}]`
  );
  assert.notStrictEqual(appStatuses[0], appStatuses[1] === 201 ? -1 : appStatuses[1],
    'Không được để CẢ HAI request ứng tuyển trùng cùng lúc đều trả 201 (double-insert)');
  // Kiểm tra chắc chắn không có 2 bản ghi application trùng nhau được tạo
  const bothSucceeded = appRes1.status === 201 && appRes2.status === 201;
  assert.strictEqual(bothSucceeded, false, 'Không được để 2 request ứng tuyển trùng cùng lúc đều thành công (vi phạm UNIQUE job_id+user_id)');
  console.log('✅ [6.2 PASS] 2 request ứng tuyển trùng (cùng job, cùng người) gửi đồng thời: không bị double-insert');

  // ── CLEANUP ──────────────────────────────────────────────────────────────
  await fetch(`${baseUrl}/api/gigs/${gigId}`, {
    method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` }
  }).catch(() => {});
  // Xoá application vừa tạo (nếu có)
  for (const res of [appRes1, appRes2]) {
    try {
      const d = await res.clone().json();
      if (res.status === 201 && d?.application?.id) {
        await fetch(`${baseUrl}/api/applications/${d.application.id}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${seekerA.token}` }
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }
  await fetch(`${baseUrl}/api/admin/users/${seekerA.id}`, {
    method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` }
  }).catch(() => {});
  await fetch(`${baseUrl}/api/admin/users/${seekerB.id}`, {
    method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` }
  }).catch(() => {});

  console.log('🧹 [CLEANUP] Đã dọn sạch gig/application/tài khoản tạm do Concurrency Test tạo ra');
}
