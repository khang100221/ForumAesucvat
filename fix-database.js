const Database = require('better-sqlite3');
const path = require('path');

// Script để sửa lỗi database ticket_logs
function fixTicketLogsTable() {
  try {
    // Kết nối database
    const dbPath = path.join(__dirname, 'database.db');
    const db = new Database(dbPath);
    
    console.log('🔧 Đang kiểm tra cấu trúc bảng ticket_logs...');
    
    // Kiểm tra cấu trúc bảng hiện tại
    const tableInfo = db.prepare('PRAGMA table_info(ticket_logs)').all();
    console.log('📋 Cấu trúc bảng hiện tại:', tableInfo.map(col => col.name));
    
    const columnNames = tableInfo.map(col => col.name);
    const hasUserIdColumn = columnNames.includes('userId');
    const hasCreatedAtColumn = columnNames.includes('createdAt');
    const hasUpdatedAtColumn = columnNames.includes('updatedAt');
    
    let needsMigration = false;
    
    // Thêm cột userId nếu chưa có
    if (!hasUserIdColumn) {
      console.log('➕ Thêm cột userId...');
      db.prepare('ALTER TABLE ticket_logs ADD COLUMN userId TEXT').run();
      needsMigration = true;
    }
    
    // Thêm cột createdAt nếu chưa có
    if (!hasCreatedAtColumn) {
      console.log('➕ Thêm cột createdAt...');
      db.prepare('ALTER TABLE ticket_logs ADD COLUMN createdAt INTEGER DEFAULT 0').run();
      needsMigration = true;
    }
    
    // Thêm cột updatedAt nếu chưa có
    if (!hasUpdatedAtColumn) {
      console.log('➕ Thêm cột updatedAt...');
      db.prepare('ALTER TABLE ticket_logs ADD COLUMN updatedAt INTEGER DEFAULT 0').run();
      needsMigration = true;
    }
    
    if (needsMigration) {
      // Cập nhật timestamp cho các record cũ
      const now = Date.now();
      const updateCount = db.prepare(`
        UPDATE ticket_logs 
        SET createdAt = ?, updatedAt = ? 
        WHERE createdAt = 0 OR createdAt IS NULL
      `).run(now, now);
      
      console.log(`📊 Đã cập nhật ${updateCount.changes} record với timestamp mới`);
      console.log('✅ Migration hoàn thành!');
    } else {
      console.log('✅ Bảng ticket_logs đã có đầy đủ cột cần thiết!');
    }
    
    // Hiển thị cấu trúc bảng sau khi migration
    const newTableInfo = db.prepare('PRAGMA table_info(ticket_logs)').all();
    console.log('📋 Cấu trúc bảng sau migration:', newTableInfo.map(col => `${col.name} (${col.type})`));
    
    // Tạo index để tối ưu performance
    try {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_guild ON ticket_logs(guildId)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_user ON ticket_logs(userId)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON ticket_logs(createdAt)').run();
      console.log('📈 Đã tạo indexes để tối ưu performance');
    } catch (indexError) {
      console.log('⚠️ Indexes có thể đã tồn tại:', indexError.message);
    }
    
    db.close();
    console.log('🎉 Hoàn thành sửa lỗi database!');
    
  } catch (error) {
    console.error('❌ Lỗi khi sửa database:', error);
    process.exit(1);
  }
}

// Chạy migration
if (require.main === module) {
  console.log('🚀 Bắt đầu sửa lỗi database ticket_logs...');
  fixTicketLogsTable();
}

module.exports = { fixTicketLogsTable };