import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

export const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table with enhanced roles
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        avatar TEXT,
        status TEXT DEFAULT 'offline',
        minecraft_username TEXT,
        bio TEXT,
        join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        post_count INTEGER DEFAULT 0,
        reputation INTEGER DEFAULT 0,
        banned INTEGER DEFAULT 0,
        ban_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Categories table
      db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        parent_id INTEGER,
        sort_order INTEGER DEFAULT 0,
        is_download_category INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id)
      )`);

      // Posts table with enhanced features
      db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        pinned INTEGER DEFAULT 0,
        locked INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        attachments TEXT,
        is_ticket INTEGER DEFAULT 0,
        ticket_status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        solved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`);

      // Comments table
      db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        parent_id INTEGER,
        hidden INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (parent_id) REFERENCES comments(id)
      )`);

      // Reactions table
      db.run(`CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER,
        comment_id INTEGER,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (comment_id) REFERENCES comments(id)
      )`);

      // Notifications table
      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        related_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      // Downloads table for mods, packs, etc.
      db.run(`CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        category TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        downloads INTEGER DEFAULT 0,
        version TEXT,
        minecraft_version TEXT,
        featured INTEGER DEFAULT 0,
        approved INTEGER DEFAULT 0,
        tags TEXT,
        screenshots TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      // Servers table
      db.run(`CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        ip TEXT NOT NULL,
        port INTEGER DEFAULT 25565,
        version TEXT,
        type TEXT,
        online_players INTEGER DEFAULT 0,
        max_players INTEGER DEFAULT 20,
        status TEXT DEFAULT 'offline',
        website TEXT,
        discord TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // User roles permissions
      db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        permission TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Reports table
      db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_user_id INTEGER,
        post_id INTEGER,
        comment_id INTEGER,
        reason TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        handled_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id),
        FOREIGN KEY (reported_user_id) REFERENCES users(id),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (comment_id) REFERENCES comments(id),
        FOREIGN KEY (handled_by) REFERENCES users(id)
      )`);

      // Insert default categories
      db.run(`INSERT OR IGNORE INTO categories (name, description, icon, color, sort_order) VALUES 
        ('Thảo luận chung', 'Nơi thảo luận về Minecraft và mọi thứ khác', '💬', '#4CAF50', 1),
        ('Hướng dẫn', 'Các hướng dẫn và tips hữu ích', '📚', '#2196F3', 2),
        ('Showcase', 'Khoe build và thành tựu của bạn', '🏆', '#FF9800', 3),
        ('Server', 'Thông tin về server và tuyển member', '🏰', '#9C27B0', 4),
        ('Báo lỗi', 'Báo cáo lỗi và vấn đề', '🐛', '#F44336', 5),
        ('Hỗ trợ', 'Cần hỗ trợ? Hỏi tại đây!', '🆘', '#795548', 6),
        ('Mods', 'Chia sẻ và tải mods', '⚙️', '#E91E63', 7),
        ('Resource Packs', 'Texture packs và resource packs', '🎨', '#8BC34A', 8),
        ('Shaders', 'Shader packs cho đồ họa đẹp', '✨', '#00BCD4', 9),
        ('Configs', 'File cấu hình và settings', '⚙️', '#607D8B', 10),
        ('Modpacks', 'Bộ mod pack hoàn chỉnh', '📦', '#3F51B5', 11)`);

      // Insert default permissions
      db.run(`INSERT OR IGNORE INTO role_permissions (role, permission) VALUES 
        ('admin', 'manage_users'),
        ('admin', 'manage_posts'),
        ('admin', 'manage_categories'),
        ('admin', 'pin_posts'),
        ('admin', 'lock_posts'),
        ('admin', 'delete_any_post'),
        ('admin', 'manage_downloads'),
        ('admin', 'manage_servers'),
        ('moderator', 'manage_posts'),
        ('moderator', 'pin_posts'),
        ('moderator', 'lock_posts'),
        ('moderator', 'delete_posts'),
        ('uploader', 'upload_files'),
        ('uploader', 'manage_own_downloads'),
        ('user', 'create_posts'),
        ('user', 'comment_posts'),
        ('user', 'react_posts')`);

      // Insert default servers
      db.run(`INSERT OR IGNORE INTO servers (name, description, ip, port, version, type) VALUES 
        ('AESUCVAT Survival', 'Server survival chính thức', 'play.aesucvat.com', 25565, '1.20.4', 'survival'),
        ('AESUCVAT Creative', 'Server creative để build', 'creative.aesucvat.com', 25565, '1.20.4', 'creative'),
        ('AESUCVAT Skyblock', 'Server skyblock thử thách', 'skyblock.aesucvat.com', 25565, '1.20.4', 'skyblock')`);

      // Create admin user
      const adminPassword = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, email, password, role, minecraft_username, bio) VALUES 
        ('admin', 'admin@aesucvat.com', ?, 'admin', 'AdminAESUCVAT', 'Quản trị viên chính của diễn đàn AESUCVAT')`, [adminPassword]);

      // Create sample moderator
      const modPassword = bcrypt.hashSync('mod123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, email, password, role, minecraft_username, bio) VALUES 
        ('moderator', 'mod@aesucvat.com', ?, 'moderator', 'ModAESUCVAT', 'Điều hành viên của diễn đàn')`, [modPassword]);

      resolve();
    });
  });
};

export default db;