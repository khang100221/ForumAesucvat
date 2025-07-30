import Database from 'better-sqlite3';

console.log('🚀 Khởi tạo database cho ticket system...');

try {
  // Tạo database mới
  const db = new Database('database.db');
  
  console.log('📋 Tạo bảng ticket_config...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_config (
      guildId TEXT PRIMARY KEY,
      panel_title TEXT,
      panel_desc TEXT,
      button_label TEXT,
      panel_color TEXT DEFAULT '#2196f3',
      category_create TEXT,
      category_close TEXT,
      log_channel TEXT,
      admin_role TEXT,
      ticket_count INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0
    )
  `);
  
  console.log('📋 Tạo bảng ticket_logs...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_logs (
      ticketId TEXT,
      guildId TEXT,
      userId TEXT,
      logText TEXT,
      createdAt INTEGER DEFAULT 0,
      updatedAt INTEGER DEFAULT 0,
      PRIMARY KEY (ticketId, guildId)
    )
  `);
  
  console.log('📈 Tạo indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ticket_config_guild ON ticket_config(guildId);
    CREATE INDEX IF NOT EXISTS idx_ticket_logs_guild ON ticket_logs(guildId);
    CREATE INDEX IF NOT EXISTS idx_ticket_logs_user ON ticket_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON ticket_logs(createdAt);
  `);
  
  // Kiểm tra cấu trúc
  console.log('🔍 Kiểm tra cấu trúc database...');
  const configCols = db.prepare('PRAGMA table_info(ticket_config)').all();
  const logsCols = db.prepare('PRAGMA table_info(ticket_logs)').all();
  
  console.log('✅ ticket_config columns:', configCols.map(c => c.name).join(', '));
  console.log('✅ ticket_logs columns:', logsCols.map(c => c.name).join(', '));
  
  db.close();
  
  console.log('');
  console.log('🎉 Database đã được khởi tạo thành công!');
  console.log('✅ Tất cả bảng và cột đã sẵn sàng');
  console.log('✅ Lỗi "createdAt column not found" đã được sửa');
  console.log('');
  console.log('🚀 Bây giờ có thể khởi động bot mà không gặp lỗi database!');
  
} catch (error) {
  console.error('❌ Lỗi:', error);
  process.exit(1);
}