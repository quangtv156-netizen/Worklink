import 'dotenv/config';
import { pool, dbReady, seedInitialData } from '../server/db.js';

async function resetDatabase() {
  console.log('====================================================');
  console.log('🔄 BẮT ĐẦU RESET TOÀN BỘ CƠ SỞ DỮ LIỆU WORKLINK');
  console.log('====================================================');

  try {
    // 1. Đợi kết nối và khởi tạo ban đầu của server/db.js hoàn tất
    await dbReady;

    // 2. Xóa sạch toàn bộ các bảng dữ liệu
    console.log('-> Đang xóa sạch toàn bộ các bảng trong PostgreSQL...');
    await pool.query(`
      TRUNCATE TABLE 
        password_resets,
        chat_messages,
        chat_threads,
        notifications,
        ratings,
        freelance_proposals,
        applications,
        gig_tasks,
        freelance_projects,
        jobs,
        users
      RESTART IDENTITY CASCADE;
    `);
    console.log('✅ Đã xóa sạch toàn bộ dữ liệu phát sinh.');

    // 3. Nạp lại toàn bộ dữ liệu mẫu sạch
    console.log('-> Đang nạp lại dữ liệu chuẩn mẫu (Seed Initial Data)...');
    await seedInitialData(true);

    console.log('====================================================');
    console.log('🎉 RESET CƠ SỞ DỮ LIỆU HOÀN TẤT THÀNH CÔNG!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Lỗi khi reset database:', err.message);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch {}
  }
}

resetDatabase();
