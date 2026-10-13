import { query } from './server/db.js';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_CLI_VIEW !== 'true') {
  console.error('❌ [BẢO MẬT] Script view-db.js bị vô hiệu hóa trong môi trường production để bảo vệ dữ liệu nhạy cảm.');
  process.exit(1);
}

const tableArg = process.argv[2]?.toLowerCase();

async function showDatabase() {
  console.log('=============================================================================');
  console.log('📊 WORKLINK DATABASE VIEWER (PostgreSQL)');
  console.log('=============================================================================\n');

  try {
    if (!tableArg || tableArg === 'users') {
      const users = await query('SELECT id, name, email, role, phone, district FROM users');
      console.log(`👤 BẢNG: users (${users.length} tài khoản)`);
      console.table(users);
      console.log('\n');
    }

    if (!tableArg || tableArg === 'jobs') {
      const jobs = await query(`
        SELECT id, employer_id, title, company, salary_display as salary, district, category 
        FROM jobs 
        ORDER BY employer_id, id
      `);
      console.log(`💼 BẢNG: jobs (${jobs.length} tin việc làm)`);
      console.table(jobs);
      console.log('\n');
    }

    if (!tableArg || tableArg === 'applications' || tableArg === 'apps') {
      const apps = await query(`
        SELECT a.id, a.applicant_name, a.phone, a.status, j.title as job_title, j.company 
        FROM applications a 
        LEFT JOIN jobs j ON a.job_id = j.id
      `);
      console.log(`📝 BẢNG: applications (${apps.length} đơn ứng tuyển)`);
      console.table(apps);
      console.log('\n');
    }

    if (!tableArg || tableArg === 'freelance') {
      const fl = await query('SELECT id, title, client, budget, duration, category FROM freelance_projects');
      console.log(`💻 BẢNG: freelance_projects (${fl.length} dự án)`);
      console.table(fl);
      console.log('\n');
    }

    if (!tableArg || tableArg === 'gigs') {
      const gigs = await query('SELECT id, title, reward, cargo_type, pickup_name, dropoff_name, status FROM gig_tasks');
      console.log(`🛵 BẢNG: gig_tasks (${gigs.length} việc vặt bản đồ)`);
      console.table(gigs);
      console.log('\n');
    }

    console.log('💡 Mẹo tra cứu nhanh:');
    console.log('   - Xem bảng users:        node view-db.js users');
    console.log('   - Xem bảng jobs:         node view-db.js jobs');
    console.log('   - Xem bảng applications: node view-db.js apps');
    console.log('=============================================================================');
  } catch (err) {
    console.error('Lỗi truy vấn database:', err.message);
  } finally {
    process.exit(0);
  }
}

showDatabase();
