# 🔧 Hướng Dẫn Sửa Lỗi Database Ticket System

## ❌ Lỗi gặp phải:
```
SqliteError: table ticket_logs has no column named createdAt
```

## 🚀 Cách sửa nhanh:

### **Phương pháp 1: Chạy script fix tự động**

1. **Chạy script fix database:**
```bash
node fix-database.js
```

2. **Khởi động lại bot:**
```bash
npm start
# hoặc
node index.js
```

### **Phương pháp 2: Sử dụng patch trong code**

1. **Import patch vào file chính của bot:**
```javascript
const { autoMigrateDatabase } = require('./ticket-system-patch');

// Trong phần khởi tạo database
const db = require('better-sqlite3')('database.db');
autoMigrateDatabase(db); // Chạy migration tự động
```

2. **Thay thế các hàm lưu database:**
```javascript
const { saveTicketLogSafe, saveTicketConfigSafe } = require('./ticket-system-patch');

// Thay vì dùng:
// db.prepare('INSERT INTO ticket_logs...').run(...)

// Dùng:
saveTicketLogSafe(db, ticketId, guildId, userId, logText);
saveTicketConfigSafe(db, guildId, configData);
```

### **Phương pháp 3: Sửa thủ công bằng SQL**

1. **Mở database SQLite:**
```bash
sqlite3 database.db
```

2. **Chạy các lệnh SQL:**
```sql
-- Thêm cột thiếu vào ticket_logs
ALTER TABLE ticket_logs ADD COLUMN userId TEXT;
ALTER TABLE ticket_logs ADD COLUMN createdAt INTEGER DEFAULT 0;
ALTER TABLE ticket_logs ADD COLUMN updatedAt INTEGER DEFAULT 0;

-- Thêm cột thiếu vào ticket_config (nếu cần)
ALTER TABLE ticket_config ADD COLUMN panel_color TEXT DEFAULT '#2196f3';
ALTER TABLE ticket_config ADD COLUMN updated_at INTEGER DEFAULT 0;

-- Tạo indexes để tối ưu
CREATE INDEX IF NOT EXISTS idx_ticket_logs_guild ON ticket_logs(guildId);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_user ON ticket_logs(userId);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON ticket_logs(createdAt);

-- Cập nhật timestamp cho records cũ
UPDATE ticket_logs SET createdAt = strftime('%s', 'now') * 1000 WHERE createdAt = 0;
UPDATE ticket_logs SET updatedAt = strftime('%s', 'now') * 1000 WHERE updatedAt = 0;

-- Thoát
.exit
```

## ✅ Kiểm tra sau khi sửa:

1. **Xem cấu trúc bảng:**
```bash
sqlite3 database.db ".schema ticket_logs"
```

2. **Kết quả mong đợi:**
```sql
CREATE TABLE ticket_logs (
  ticketId TEXT,
  guildId TEXT,
  logText TEXT,
  userId TEXT,
  createdAt INTEGER DEFAULT 0,
  updatedAt INTEGER DEFAULT 0,
  PRIMARY KEY (ticketId, guildId)
);
```

## 🔄 Tự động migration trong tương lai:

**Thêm vào file index.js hoặc main bot file:**
```javascript
const Database = require('better-sqlite3');
const { autoMigrateDatabase } = require('./ticket-system-patch');

// Khởi tạo database
const db = new Database('database.db');

// Chạy migration tự động khi bot start
console.log('🔧 Running database migrations...');
autoMigrateDatabase(db);
console.log('✅ Database ready!');

// Tiếp tục khởi tạo bot...
```

## 🛡️ Backup database trước khi sửa:

```bash
# Backup database
cp database.db database.db.backup

# Nếu có lỗi, restore:
cp database.db.backup database.db
```

## 📋 Cấu trúc database hoàn chỉnh:

### **ticket_config table:**
```sql
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
);
```

### **ticket_logs table:**
```sql
CREATE TABLE ticket_logs (
  ticketId TEXT,
  guildId TEXT,
  userId TEXT,
  logText TEXT,
  createdAt INTEGER DEFAULT 0,
  updatedAt INTEGER DEFAULT 0,
  PRIMARY KEY (ticketId, guildId)
);
```

## 🚨 Lưu ý quan trọng:

1. **Luôn backup database trước khi sửa**
2. **Test trên server dev trước khi deploy production**
3. **Sử dụng migration script để tránh lỗi tương lai**
4. **Kiểm tra logs sau khi restart bot**

## 💡 Tips:

- Script `fix-database.js` sẽ tự động detect và thêm các cột thiếu
- Patch `ticket-system-patch.js` sẽ handle database một cách an toàn
- Nếu vẫn gặp lỗi, hãy check console logs để debug

---

**🎉 Sau khi sửa xong, ticket system sẽ hoạt động bình thường với đầy đủ tính năng!**