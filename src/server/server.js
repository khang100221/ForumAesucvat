import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = 'aesucvat-secret-key-2024';

// Ensure uploads directory exists
const uploadsDir = join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Database setup
const dbPath = join(__dirname, '../../database.db');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Handle database connection errors
db.on('error', (err) => {
  console.error('❌ Database error:', err);
});

// Initialize database
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Posts table
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
        FOREIGN KEY (post_id) REFERENCES posts(id)
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
        FOREIGN KEY (post_id) REFERENCES posts(id)
      )`);

      // Downloads table
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
        approved INTEGER DEFAULT 1,
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
        status TEXT DEFAULT 'online',
        website TEXT,
        discord TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

      // Insert default data
      db.run(`INSERT OR IGNORE INTO categories (name, description, icon, color, sort_order) VALUES 
        ('Thảo luận chung', 'Nơi thảo luận về Minecraft và mọi thứ khác', '💬', '#4CAF50', 1),
        ('Hướng dẫn', 'Các hướng dẫn và tips hữu ích', '📚', '#2196F3', 2),
        ('Showcase', 'Khoe build và thành tựu của bạn', '🏆', '#FF9800', 3),
        ('Server', 'Thông tin về server và tuyển member', '🏰', '#9C27B0', 4),
        ('Báo lỗi', 'Báo cáo lỗi và vấn đề', '🐛', '#F44336', 5),
        ('Hỗ trợ', 'Cần hỗ trợ? Hỏi tại đây!', '🆘', '#795548', 6)`);

      // Insert default servers
      db.run(`INSERT OR IGNORE INTO servers (name, description, ip, port, version, type, online_players, max_players) VALUES 
        ('AESUCVAT Survival', 'Server survival chính thức của AESUCVAT', 'play.aesucvat.com', 25565, '1.20.4', 'survival', 45, 100),
        ('AESUCVAT Creative', 'Server creative để build tự do', 'creative.aesucvat.com', 25565, '1.20.4', 'creative', 23, 50),
        ('AESUCVAT Skyblock', 'Server skyblock thử thách', 'skyblock.aesucvat.com', 25565, '1.20.4', 'skyblock', 67, 80)`);

      // Create admin user
      const adminPassword = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, email, password, role, minecraft_username, bio) VALUES 
        ('admin', 'admin@aesucvat.com', ?, 'admin', 'AdminAESUCVAT', 'Quản trị viên chính của diễn đàn AESUCVAT')`, [adminPassword]);

      // Create moderator
      const modPassword = bcrypt.hashSync('mod123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, email, password, role, minecraft_username, bio) VALUES 
        ('moderator', 'mod@aesucvat.com', ?, 'moderator', 'ModAESUCVAT', 'Điều hành viên của diễn đàn')`, [modPassword]);

      // Insert sample downloads
      db.run(`INSERT OR IGNORE INTO downloads (name, description, file_path, file_size, category, user_id, version, minecraft_version, featured, tags) VALUES 
        ('OptiFine HD', 'Mod tối ưu hóa đồ họa và hiệu suất cho Minecraft', 'downloads/optifine.jar', 2048000, 'mods', 1, '1.20.4', '1.20.4', 1, 'optimization,graphics'),
        ('Faithful 32x', 'Resource pack nâng cấp texture lên 32x32', 'downloads/faithful.zip', 15360000, 'packs', 1, '1.20.4', '1.20.4', 1, 'texture,faithful'),
        ('SEUS PTGI', 'Shader pack với ray tracing đẹp mắt', 'downloads/seus.zip', 5120000, 'shaders', 1, '1.20.4', '1.20.4', 1, 'raytracing,realistic'),
        ('All The Mods 9', 'Modpack khổng lồ với hơn 400 mods', 'downloads/atm9.zip', 512000000, 'modpacks', 1, '0.2.44', '1.20.1', 1, 'kitchen-sink,tech,magic')`);

      // Insert sample posts
      db.run(`INSERT OR IGNORE INTO posts (title, content, user_id, category_id, views, pinned) VALUES 
        ('Chào mừng đến với AESUCVAT!', 'Xin chào tất cả mọi người! Đây là bài viết chào mừng đầu tiên trên diễn đàn AESUCVAT. Hãy cùng nhau xây dựng một cộng đồng Minecraft tuyệt vời!', 1, 1, 156, 1),
        ('Hướng dẫn cài đặt OptiFine', 'Trong bài viết này, mình sẽ hướng dẫn các bạn cách cài đặt OptiFine để tối ưu hóa Minecraft...', 1, 2, 89, 0),
        ('Showcase: Lâu đài Medieval', 'Mình vừa hoàn thành một lâu đài medieval khổng lồ sau 3 tháng xây dựng. Hãy cùng xem nhé!', 2, 3, 234, 0)`);

      resolve();
    });
  });
};

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Serve static files from dist directory (for production)
const distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Auth routes
app.post('/api/register', async (req, res) => {
  const { username, email, password, minecraft_username } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password, minecraft_username) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, minecraft_username || username],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign(
          { id: this.lastID, username, role: 'user' },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        res.json({ 
          token, 
          user: { 
            id: this.lastID, 
            username, 
            email, 
            role: 'user',
            minecraft_username: minecraft_username || username,
            status: 'online'
          } 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (user.banned) {
          return res.status(403).json({ error: 'Account is banned: ' + user.ban_reason });
        }
        
        if (!bcrypt.compareSync(password, user.password)) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last active
        db.run('UPDATE users SET last_active = CURRENT_TIMESTAMP, status = "online" WHERE id = ?', [user.id]);
        
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            username: user.username, 
            email: user.email, 
            role: user.role,
            avatar: user.avatar,
            minecraft_username: user.minecraft_username,
            bio: user.bio,
            reputation: user.reputation,
            post_count: user.post_count,
            status: 'online'
          } 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', authenticateToken, (req, res) => {
  db.run('UPDATE users SET status = "offline" WHERE id = ?', [req.user.id]);
  res.json({ message: 'Logged out successfully' });
});

// Categories routes
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY sort_order, name', (err, categories) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(categories);
  });
});

// Posts routes
app.get('/api/posts', (req, res) => {
  const { category, page = 1, limit = 10, search, type = 'all' } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT p.*, u.username, u.avatar, u.role, u.minecraft_username, c.name as category_name, c.color as category_color,
           COUNT(DISTINCT cm.id) as comment_count,
           COUNT(DISTINCT r.id) as reaction_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN comments cm ON p.id = cm.post_id AND cm.hidden = 0
    LEFT JOIN reactions r ON p.id = r.post_id
  `;
  
  const conditions = [];
  const params = [];
  
  if (category) {
    conditions.push('p.category_id = ?');
    params.push(category);
  }
  
  if (search) {
    conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (type === 'tickets') {
    conditions.push('p.is_ticket = 1');
  } else if (type === 'regular') {
    conditions.push('p.is_ticket = 0');
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' GROUP BY p.id ORDER BY p.pinned DESC, p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.all(query, params, (err, posts) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(posts);
  });
});

app.get('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  
  // Update view count
  db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [id]);
  
  db.get(`
    SELECT p.*, u.username, u.avatar, u.role, u.minecraft_username, c.name as category_name, c.color as category_color
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `, [id], (err, post) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Get comments
    db.all(`
      SELECT c.*, u.username, u.avatar, u.role, u.minecraft_username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.hidden = 0
      ORDER BY c.created_at ASC
    `, [id], (err, comments) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get reactions
      db.all(`
        SELECT r.*, u.username
        FROM reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.post_id = ?
      `, [id], (err, reactions) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ ...post, comments, reactions });
      });
    });
  });
});

app.post('/api/posts', authenticateToken, upload.array('attachments'), (req, res) => {
  const { title, content, category_id, is_ticket, priority } = req.body;
  const attachments = req.files ? req.files.map(file => file.filename) : [];
  
  if (!title || !content || !category_id) {
    return res.status(400).json({ error: 'Title, content, and category are required' });
  }
  
  db.run(
    'INSERT INTO posts (title, content, user_id, category_id, attachments, is_ticket, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, content, req.user.id, category_id, JSON.stringify(attachments), is_ticket || 0, priority || 'normal'],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update user post count
      db.run('UPDATE users SET post_count = post_count + 1 WHERE id = ?', [req.user.id]);
      
      res.json({ id: this.lastID, message: 'Post created successfully' });
    }
  );
});

// Comments routes
app.post('/api/comments', authenticateToken, (req, res) => {
  const { content, post_id, parent_id } = req.body;
  
  if (!content || !post_id) {
    return res.status(400).json({ error: 'Content and post_id are required' });
  }
  
  db.run(
    'INSERT INTO comments (content, user_id, post_id, parent_id) VALUES (?, ?, ?, ?)',
    [content, req.user.id, post_id, parent_id || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, message: 'Comment created successfully' });
    }
  );
});

// Reactions routes
app.post('/api/reactions', authenticateToken, (req, res) => {
  const { emoji, post_id, comment_id } = req.body;
  
  if (!emoji || (!post_id && !comment_id)) {
    return res.status(400).json({ error: 'Emoji and target are required' });
  }
  
  // Check if reaction already exists
  const checkQuery = post_id 
    ? 'SELECT * FROM reactions WHERE user_id = ? AND post_id = ? AND emoji = ?'
    : 'SELECT * FROM reactions WHERE user_id = ? AND comment_id = ? AND emoji = ?';
  
  const checkParams = post_id 
    ? [req.user.id, post_id, emoji]
    : [req.user.id, comment_id, emoji];
  
  db.get(checkQuery, checkParams, (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existing) {
      // Remove reaction
      db.run('DELETE FROM reactions WHERE id = ?', [existing.id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Reaction removed' });
      });
    } else {
      // Add reaction
      db.run(
        'INSERT INTO reactions (user_id, post_id, comment_id, emoji) VALUES (?, ?, ?, ?)',
        [req.user.id, post_id || null, comment_id || null, emoji],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ id: this.lastID, message: 'Reaction added' });
        }
      );
    }
  });
});

// Downloads routes
app.get('/api/downloads', (req, res) => {
  const { category, page = 1, limit = 12, search, featured } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT d.*, u.username, u.minecraft_username
    FROM downloads d
    JOIN users u ON d.user_id = u.id
    WHERE d.approved = 1
  `;
  
  const params = [];
  
  if (category) {
    query += ' AND d.category = ?';
    params.push(category);
  }
  
  if (search) {
    query += ' AND (d.name LIKE ? OR d.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (featured) {
    query += ' AND d.featured = 1';
  }
  
  query += ' ORDER BY d.featured DESC, d.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.all(query, params, (err, downloads) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(downloads);
  });
});

// Servers routes
app.get('/api/servers', (req, res) => {
  db.all('SELECT * FROM servers ORDER BY created_at DESC', (err, servers) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(servers);
  });
});

// Notifications routes
app.get('/api/notifications', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [req.user.id],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(notifications);
    }
  );
});

// Stats routes
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.users = result.count;
    
    db.get('SELECT COUNT(*) as count FROM posts', (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.posts = result.count;
      
      db.get('SELECT COUNT(*) as count FROM downloads WHERE approved = 1', (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.downloads = result.count;
        
        db.get('SELECT COUNT(*) as count FROM users WHERE status = "online"', (err, result) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.online = result.count;
          
          res.json(stats);
        });
      });
    });
  });
});

// Admin routes
app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  db.all('SELECT id, username, email, role, status, minecraft_username, post_count, reputation, banned, ban_reason, created_at, last_active FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

app.put('/api/admin/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { id } = req.params;
  const { role, banned, ban_reason } = req.body;
  
  db.run(
    'UPDATE users SET role = ?, banned = ?, ban_reason = ? WHERE id = ?',
    [role, banned ? 1 : 0, ban_reason || null, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'User updated successfully' });
    }
  );
});

app.put('/api/admin/posts/:id/pin', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { id } = req.params;
  const { pinned } = req.body;
  
  db.run(
    'UPDATE posts SET pinned = ? WHERE id = ?',
    [pinned ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Post pin status updated' });
    }
  );
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't handle API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const distPath = path.join(__dirname, '../../dist');
  const indexPath = path.join(distPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({ 
      message: 'AESUCVAT Forum Backend Server is running!',
      status: 'Server OK',
      frontend: 'Please access the frontend at http://localhost:5173',
      api: 'API available at /api/*'
    });
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AESUCVAT Forum Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: SQLite (database.db)`);
    console.log(`🔐 Admin credentials: admin / admin123`);
    console.log(`🛡️  Moderator credentials: moderator / mod123`);
    console.log(`✅ All APIs ready!`);
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please close other applications using this port.`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
    }
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});