// Patch cho ticket system để xử lý database an toàn hơn

// Hàm helper: Kiểm tra cột database an toàn
function checkDatabaseColumns(db, tableName) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columnNames = tableInfo.map(col => col.name);
    
    return {
      exists: tableInfo.length > 0,
      columns: columnNames,
      hasUserId: columnNames.includes('userId'),
      hasCreatedAt: columnNames.includes('createdAt'),
      hasUpdatedAt: columnNames.includes('updatedAt'),
      hasPanelColor: columnNames.includes('panel_color')
    };
  } catch (error) {
    console.error(`Error checking ${tableName} columns:`, error);
    return {
      exists: false,
      columns: [],
      hasUserId: false,
      hasCreatedAt: false,
      hasUpdatedAt: false,
      hasPanelColor: false
    };
  }
}

// Hàm lưu ticket log an toàn
function saveTicketLogSafe(db, ticketId, guildId, userId, logText) {
  try {
    const tableCheck = checkDatabaseColumns(db, 'ticket_logs');
    
    if (!tableCheck.exists) {
      console.error('Table ticket_logs does not exist');
      return false;
    }
    
    const fullTicketId = `ticket-${ticketId}`;
    
    if (tableCheck.hasUserId && tableCheck.hasCreatedAt && tableCheck.hasUpdatedAt) {
      // Bảng có đầy đủ cột mới
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, userId, logText, createdAt) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(ticketId, guildId) DO UPDATE SET 
          userId = ?, logText = ?, updatedAt = ?
      `).run(
        fullTicketId, guildId, userId, logText, Date.now(),
        userId, logText, Date.now()
      );
    } else if (tableCheck.hasUserId) {
      // Bảng có userId nhưng không có timestamp columns
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, userId, logText) 
        VALUES (?, ?, ?, ?) 
        ON CONFLICT(ticketId, guildId) DO UPDATE SET 
          userId = ?, logText = ?
      `).run(
        fullTicketId, guildId, userId, logText,
        userId, logText
      );
    } else {
      // Bảng cũ chỉ có các cột cơ bản
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, logText) 
        VALUES (?, ?, ?) 
        ON CONFLICT(ticketId, guildId) DO UPDATE SET logText = ?
      `).run(fullTicketId, guildId, logText, logText);
    }
    
    return true;
  } catch (error) {
    console.error('Database save error:', error);
    return false;
  }
}

// Hàm lưu config ticket an toàn
function saveTicketConfigSafe(db, guildId, configData) {
  try {
    const tableCheck = checkDatabaseColumns(db, 'ticket_config');
    
    if (!tableCheck.exists) {
      console.error('Table ticket_config does not exist');
      return false;
    }
    
    // Tạo dynamic query dựa trên các cột có sẵn
    const columns = ['guildId'];
    const values = [guildId];
    const updatePairs = [];
    
    // Kiểm tra và thêm các cột nếu tồn tại
    const possibleColumns = {
      'panel_title': configData.panel_title,
      'panel_desc': configData.panel_desc,
      'button_label': configData.button_label,
      'panel_color': configData.panel_color,
      'category_create': configData.category_create,
      'category_close': configData.category_close,
      'log_channel': configData.log_channel,
      'admin_role': configData.admin_role,
      'ticket_count': configData.ticket_count
    };
    
    for (const [column, value] of Object.entries(possibleColumns)) {
      if (value !== undefined && tableCheck.columns.includes(column)) {
        columns.push(column);
        values.push(value);
        updatePairs.push(`${column} = ?`);
        values.push(value); // Thêm value cho UPDATE clause
      }
    }
    
    // Thêm updated_at nếu có
    if (tableCheck.hasUpdatedAt) {
      columns.push('updated_at');
      values.push(Date.now());
      updatePairs.push('updated_at = ?');
      values.push(Date.now());
    }
    
    const placeholders = columns.map(() => '?').join(', ');
    const query = `
      INSERT INTO ticket_config (${columns.join(', ')}) 
      VALUES (${placeholders}) 
      ON CONFLICT(guildId) DO UPDATE SET ${updatePairs.join(', ')}
    `;
    
    db.prepare(query).run(...values);
    return true;
    
  } catch (error) {
    console.error('Config save error:', error);
    return false;
  }
}

// Hàm migrate database tự động
function autoMigrateDatabase(db) {
  try {
    console.log('🔧 Checking database structure...');
    
    // Kiểm tra và tạo bảng ticket_config nếu chưa có
    const configTableCheck = checkDatabaseColumns(db, 'ticket_config');
    if (!configTableCheck.exists) {
      console.log('📋 Creating ticket_config table...');
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
    } else {
      // Thêm các cột thiếu vào bảng ticket_config
      if (!configTableCheck.hasPanelColor) {
        console.log('➕ Adding panel_color column to ticket_config...');
        db.prepare('ALTER TABLE ticket_config ADD COLUMN panel_color TEXT DEFAULT "#2196f3"').run();
      }
      if (!configTableCheck.hasUpdatedAt) {
        console.log('➕ Adding updated_at column to ticket_config...');
        db.prepare('ALTER TABLE ticket_config ADD COLUMN updated_at INTEGER DEFAULT 0').run();
      }
    }
    
    // Kiểm tra và tạo bảng ticket_logs nếu chưa có
    const logsTableCheck = checkDatabaseColumns(db, 'ticket_logs');
    if (!logsTableCheck.exists) {
      console.log('📋 Creating ticket_logs table...');
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
    } else {
      // Thêm các cột thiếu vào bảng ticket_logs
      if (!logsTableCheck.hasUserId) {
        console.log('➕ Adding userId column to ticket_logs...');
        db.prepare('ALTER TABLE ticket_logs ADD COLUMN userId TEXT').run();
      }
      if (!logsTableCheck.hasCreatedAt) {
        console.log('➕ Adding createdAt column to ticket_logs...');
        db.prepare('ALTER TABLE ticket_logs ADD COLUMN createdAt INTEGER DEFAULT 0').run();
      }
      if (!logsTableCheck.hasUpdatedAt) {
        console.log('➕ Adding updatedAt column to ticket_logs...');
        db.prepare('ALTER TABLE ticket_logs ADD COLUMN updatedAt INTEGER DEFAULT 0').run();
      }
    }
    
    // Tạo indexes
    try {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_config_guild ON ticket_config(guildId)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_guild ON ticket_logs(guildId)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_user ON ticket_logs(userId)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON ticket_logs(createdAt)').run();
      console.log('📈 Database indexes created/verified');
    } catch (indexError) {
      console.log('⚠️ Some indexes may already exist');
    }
    
    console.log('✅ Database migration completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    return false;
  }
}

// Export functions
module.exports = {
  checkDatabaseColumns,
  saveTicketLogSafe,
  saveTicketConfigSafe,
  autoMigrateDatabase
};

// Usage example:
/*
const db = require('better-sqlite3')('database.db');
const { autoMigrateDatabase, saveTicketLogSafe, saveTicketConfigSafe } = require('./ticket-system-patch');

// Run migration on startup
autoMigrateDatabase(db);

// Use safe functions
saveTicketLogSafe(db, '001', 'guild123', 'user456', 'Log content...');
saveTicketConfigSafe(db, 'guild123', {
  panel_title: 'Support Tickets',
  panel_desc: 'Click to create a ticket',
  button_label: 'Create Ticket',
  panel_color: '#2196f3'
});
*/