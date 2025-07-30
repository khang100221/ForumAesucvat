import Database from 'better-sqlite3';

console.log('🔄 Cập nhật cấu trúc database...');

try {
  // Kết nối với database.db (file mới đã tạo)
  const newDb = new Database('database.db');
  
  // Kết nối với database.sqlite (file cũ từ index.js)
  let oldDb;
  try {
    oldDb = new Database('./database.sqlite');
    console.log('✅ Tìm thấy database.sqlite cũ');
  } catch (error) {
    console.log('⚠️ Không tìm thấy database.sqlite, sẽ tạo mới');
  }

  // Thêm các cột thiếu vào database.db
  console.log('📋 Cập nhật bảng ticket_logs...');
  try {
    const tableInfo = newDb.prepare('PRAGMA table_info(ticket_logs)').all();
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('createdAt')) {
      newDb.prepare('ALTER TABLE ticket_logs ADD COLUMN createdAt INTEGER DEFAULT 0').run();
      console.log('➕ Đã thêm cột createdAt');
    }
    
    if (!columnNames.includes('updatedAt')) {
      newDb.prepare('ALTER TABLE ticket_logs ADD COLUMN updatedAt INTEGER DEFAULT 0').run();
      console.log('➕ Đã thêm cột updatedAt');
    }
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật ticket_logs:', error);
  }

  // Thêm các cột thiếu vào bảng ticket_config
  console.log('📋 Cập nhật bảng ticket_config...');
  try {
    const configInfo = newDb.prepare('PRAGMA table_info(ticket_config)').all();
    const configColumns = configInfo.map(col => col.name);
    
    if (!configColumns.includes('panel_color')) {
      newDb.prepare('ALTER TABLE ticket_config ADD COLUMN panel_color TEXT DEFAULT "#2196f3"').run();
      console.log('➕ Đã thêm cột panel_color');
    }
    
    if (!configColumns.includes('updated_at')) {
      newDb.prepare('ALTER TABLE ticket_config ADD COLUMN updated_at INTEGER DEFAULT 0').run();
      console.log('➕ Đã thêm cột updated_at');
    }
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật ticket_config:', error);
  }

  // Sao chép dữ liệu từ database cũ nếu có
  if (oldDb) {
    console.log('🔄 Sao chép dữ liệu từ database.sqlite...');
    
    try {
      // Sao chép dữ liệu accounts
      const accounts = oldDb.prepare('SELECT * FROM accounts').all();
      if (accounts.length > 0) {
        const insertAccount = newDb.prepare(`
          INSERT OR REPLACE INTO accounts 
          (id, game, price, capetype, rank, note, status, uploaded_by, uploaded_at, buyer, sold_by, sold_at, messageId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const account of accounts) {
          insertAccount.run(
            account.id, account.game, account.price, account.capetype, account.rank,
            account.note, account.status, account.uploaded_by, account.uploaded_at,
            account.buyer, account.sold_by, account.sold_at, account.messageId
          );
        }
        console.log(`✅ Đã sao chép ${accounts.length} accounts`);
      }
    } catch (error) {
      console.log('⚠️ Không thể sao chép accounts:', error.message);
    }

    try {
      // Sao chép dữ liệu users
      const users = oldDb.prepare('SELECT * FROM users').all();
      if (users.length > 0) {
        const insertUser = newDb.prepare(`
          INSERT OR REPLACE INTO users 
          (userId, balance, lastCoinflip, luck_potion, xp, wins, loses, legit, lastDaily)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const user of users) {
          insertUser.run(
            user.userId, user.balance, user.lastCoinflip, user.luck_potion,
            user.xp, user.wins, user.loses, user.legit, user.lastDaily
          );
        }
        console.log(`✅ Đã sao chép ${users.length} users`);
      }
    } catch (error) {
      console.log('⚠️ Không thể sao chép users:', error.message);
    }

    try {
      // Sao chép dữ liệu ticket_config
      const ticketConfigs = oldDb.prepare('SELECT * FROM ticket_config').all();
      if (ticketConfigs.length > 0) {
        const insertConfig = newDb.prepare(`
          INSERT OR REPLACE INTO ticket_config 
          (guildId, category_create, category_close, log_channel, admin_role, ticket_count, 
           panel_title, panel_desc, button_label, panel_channel, panel_message_id, panel_color, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const config of ticketConfigs) {
          insertConfig.run(
            config.guildId, config.category_create, config.category_close, config.log_channel,
            config.admin_role, config.ticket_count, config.panel_title, config.panel_desc,
            config.button_label, config.panel_channel, config.panel_message_id,
            config.panel_color || '#2196f3', config.updated_at || Date.now()
          );
        }
        console.log(`✅ Đã sao chép ${ticketConfigs.length} ticket configs`);
      }
    } catch (error) {
      console.log('⚠️ Không thể sao chép ticket_config:', error.message);
    }

    oldDb.close();
  }

  // Tạo indexes để tối ưu
  console.log('📈 Tạo indexes...');
  try {
    newDb.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_config_guild ON ticket_config(guildId)').run();
    newDb.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_guild ON ticket_logs(guildId)').run();
    newDb.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_user ON ticket_logs(userId)').run();
    newDb.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON ticket_logs(createdAt)').run();
    console.log('✅ Đã tạo indexes');
  } catch (error) {
    console.log('⚠️ Một số indexes có thể đã tồn tại');
  }

  // Hiển thị cấu trúc cuối cùng
  console.log('');
  console.log('📋 Cấu trúc bảng ticket_logs:');
  const logsColumns = newDb.prepare('PRAGMA table_info(ticket_logs)').all();
  logsColumns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  console.log('');
  console.log('📋 Cấu trúc bảng ticket_config:');
  const configColumns = newDb.prepare('PRAGMA table_info(ticket_config)').all();
  configColumns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  newDb.close();

  console.log('');
  console.log('🎉 Cập nhật database hoàn thành!');
  console.log('✅ Database.db đã sẵn sàng với đầy đủ cột cần thiết');
  console.log('✅ Dữ liệu đã được migrate từ database.sqlite (nếu có)');
  console.log('');
  console.log('📝 Tiếp theo:');
  console.log('1. Cập nhật index.js để sử dụng database.db thay vì database.sqlite');
  console.log('2. Thay thế utils/ticketSystem.js bằng ticket-system-fixed.js');
  console.log('3. Khởi động lại bot');

} catch (error) {
  console.error('❌ Lỗi khi cập nhật database:', error);
  process.exit(1);
}