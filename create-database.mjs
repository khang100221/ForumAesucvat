import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Script để tạo database mới với cấu trúc đúng
function createNewDatabase() {
  try {
    // Backup database cũ nếu tồn tại
    const dbPath = join(__dirname, 'database.db');
    
    console.log('🗑️ Xóa database cũ (nếu có)...');
    try {
      // Xóa file database cũ
      import('fs').then(fs => {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
          console.log('✅ Đã xóa database cũ');
        }
      });
    } catch (e) {
      // Ignore error
    }
    
    // Tạo database mới
    console.log('🔧 Tạo database mới...');
    const db = new Database(dbPath);
    
    // Tạo bảng ticket_config
    console.log('📋 Tạo bảng ticket_config...');
    db.prepare(`
      CREATE TABLE ticket_config (
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
    `).run();
    
    // Tạo bảng ticket_logs
    console.log('📋 Tạo bảng ticket_logs...');
    db.prepare(`
      CREATE TABLE ticket_logs (
        ticketId TEXT,
        guildId TEXT,
        userId TEXT,
        logText TEXT,
        createdAt INTEGER DEFAULT 0,
        updatedAt INTEGER DEFAULT 0,
        PRIMARY KEY (ticketId, guildId)
      )
    `).run();
    
    // Tạo indexes để tối ưu performance
    console.log('📈 Tạo indexes...');
    db.prepare('CREATE INDEX idx_ticket_config_guild ON ticket_config(guildId)').run();
    db.prepare('CREATE INDEX idx_ticket_logs_guild ON ticket_logs(guildId)').run();
    db.prepare('CREATE INDEX idx_ticket_logs_user ON ticket_logs(userId)').run();
    db.prepare('CREATE INDEX idx_ticket_logs_created ON ticket_logs(createdAt)').run();
    
    // Kiểm tra cấu trúc đã tạo
    console.log('🔍 Kiểm tra cấu trúc database...');
    
    const configTableInfo = db.prepare('PRAGMA table_info(ticket_config)').all();
    console.log('📋 Bảng ticket_config:', configTableInfo.map(col => `${col.name} (${col.type})`));
    
    const logsTableInfo = db.prepare('PRAGMA table_info(ticket_logs)').all();
    console.log('📋 Bảng ticket_logs:', logsTableInfo.map(col => `${col.name} (${col.type})`));
    
    // Thêm một số dữ liệu mẫu để test
    console.log('🧪 Thêm dữ liệu test...');
    const testGuildId = 'test_guild_123';
    
    db.prepare(`
      INSERT INTO ticket_config (guildId, panel_title, panel_desc, button_label, panel_color, ticket_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      testGuildId,
      '🎫 HỖ TRỢ KHÁCH HÀNG',
      'Nhấn **MỞ TICKET** để được hỗ trợ riêng!\n\n📋 **Hướng dẫn:**\n• Mô tả vấn đề chi tiết\n• Đính kèm ảnh nếu cần\n• Đợi admin hỗ trợ',
      '🎫 MỞ TICKET',
      '#2196f3',
      0
    );
    
    db.prepare(`
      INSERT INTO ticket_logs (ticketId, guildId, userId, logText, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'ticket-001',
      testGuildId,
      'test_user_456',
      '# Test Ticket Log\n\nThis is a test ticket log entry.',
      Date.now(),
      Date.now()
    );
    
    // Test query để đảm bảo hoạt động
    console.log('✅ Test queries...');
    const configTest = db.prepare('SELECT * FROM ticket_config WHERE guildId = ?').get(testGuildId);
    console.log('📊 Config test:', configTest ? 'OK' : 'FAILED');
    
    const logTest = db.prepare('SELECT * FROM ticket_logs WHERE guildId = ?').get(testGuildId);
    console.log('📊 Log test:', logTest ? 'OK' : 'FAILED');
    
    db.close();
    
    console.log('');
    console.log('🎉 Database đã được tạo thành công!');
    console.log('✅ Cấu trúc database hoàn chỉnh với tất cả cột cần thiết');
    console.log('✅ Indexes đã được tạo để tối ưu performance');
    console.log('✅ Dữ liệu test đã được thêm');
    console.log('');
    console.log('🚀 Bây giờ bạn có thể khởi động bot:');
    console.log('   npm start');
    console.log('   # hoặc');
    console.log('   node index.js');
    
  } catch (error) {
    console.error('❌ Lỗi khi tạo database:', error);
    console.log('');
    console.log('💡 Gợi ý khắc phục:');
    console.log('1. Đảm bảo có quyền ghi vào thư mục hiện tại');
    console.log('2. Đảm bảo better-sqlite3 đã được cài đặt');
    console.log('3. Thử chạy lại với quyền admin/sudo');
    process.exit(1);
  }
}

// Chạy tạo database
console.log('🚀 Bắt đầu tạo database mới cho ticket system...');
console.log('⚠️  Database cũ sẽ bị xóa và thay thế!');
createNewDatabase();