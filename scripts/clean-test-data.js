import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, query, run } from '../server/db.js';

async function cleanTestData() {
  console.log('🧹 Bắt đầu dọn dẹp dữ liệu rác từ các đợt chạy test tự động...');
  await initDatabase();

  // 1. Dọn freelance projects có title chứa pattern test
  const testProjects = await query(`
    SELECT id, title FROM freelance_projects 
    WHERE title LIKE '%RBAC Test%' 
       OR title LIKE '%Test Freelance%' 
       OR title LIKE '%Dự án Freelance trái phép%'
       OR id LIKE 'proj-test-%'
  `);
  console.log(`🔍 Tìm thấy ${testProjects.length} dự án freelance test rác.`);
  for (const p of testProjects) {
    await run('DELETE FROM freelance_proposals WHERE project_id = ?', [p.id]);
    await run('DELETE FROM notifications WHERE link_id = ?', [p.id]).catch(() => {});
    await run('DELETE FROM freelance_projects WHERE id = ?', [p.id]);
    console.log(`   - Đã xoá dự án: [${p.id}] ${p.title}`);
  }

  // 2. Dọn gig_tasks rác có title chứa pattern test
  const testGigs = await query(`
    SELECT id, title FROM gig_tasks 
    WHERE title LIKE '%RBAC Test%' 
       OR title LIKE '%Việc vặt trái phép%'
       OR id LIKE 'gig-test-%'
  `);
  console.log(`🔍 Tìm thấy ${testGigs.length} việc vặt test rác.`);
  for (const g of testGigs) {
    await run('DELETE FROM notifications WHERE link_id = ?', [g.id]).catch(() => {});
    await run('DELETE FROM gig_tasks WHERE id = ?', [g.id]);
    console.log(`   - Đã xoá việc vặt: [${g.id}] ${g.title}`);
  }

  // 3. Dọn jobs rác do test tạo
  const testJobs = await query(`
    SELECT id, title FROM jobs 
    WHERE title LIKE '%Barista Full-stack%' 
       OR title LIKE '%Barista Trưởng Ca%' 
       OR title LIKE '%Công việc vi phạm quyền%'
       OR title LIKE '%Job RBAC Test%'
       OR id LIKE 'job-test-%'
  `);
  console.log(`🔍 Tìm thấy ${testJobs.length} tin tuyển dụng test rác.`);
  for (const j of testJobs) {
    await run('DELETE FROM applications WHERE job_id = ?', [j.id]).catch(() => {});
    await run('DELETE FROM notifications WHERE link_id = ?', [j.id]).catch(() => {});
    await run('DELETE FROM jobs WHERE id = ?', [j.id]);
    console.log(`   - Đã xoá tin: [${j.id}] ${j.title}`);
  }

  // 4. Dọn users rác do test tạo
  const testUsers = await query(`
    SELECT id, email, name FROM users 
    WHERE email LIKE 'rival_%@worklink.vn' 
       OR email LIKE 'test_%@%' 
       OR email LIKE '%_test@%'
  `);
  console.log(`🔍 Tìm thấy ${testUsers.length} tài khoản test rác.`);
  for (const u of testUsers) {
    await run('DELETE FROM applications WHERE user_id = ?', [u.id]).catch(() => {});
    await run('DELETE FROM freelance_proposals WHERE user_id = ?', [u.id]).catch(() => {});
    await run('DELETE FROM notifications WHERE user_id = ?', [u.id]).catch(() => {});
    await run('DELETE FROM users WHERE id = ?', [u.id]);
    console.log(`   - Đã xoá tài khoản: [${u.id}] ${u.email}`);
  }

  console.log('✅ Hoàn tất dọn dẹp dữ liệu test!');
  process.exit(0);
}

cleanTestData().catch(err => {
  console.error('❌ Lỗi khi dọn dẹp dữ liệu test:', err);
  process.exit(1);
});
