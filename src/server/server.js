import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db, { initializeDatabase } from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = 'aesucvat-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../../uploads')));

// Ensure directories exist
const uploadsDir = join(__dirname, '../../uploads');
const avatarsDir = join(uploadsDir, 'avatars');
const attachmentsDir = join(uploadsDir, 'attachments');
const downloadsDir = join(uploadsDir, 'downloads');

[uploadsDir, avatarsDir, attachmentsDir, downloadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for different file types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = uploadsDir;
    if (req.route.path.includes('avatar')) dest = avatarsDir;
    else if (req.route.path.includes('downloads')) dest = downloadsDir;
    else dest = attachmentsDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = file.originalname.split('.').pop();
    cb(null, `${uniqueSuffix}.${extension}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.zip', '.jar', '.png', '.jpg', '.jpeg', '.json', '.cfg', '.txt', '.mcpack', '.mcworld', '.mcaddon'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
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

// Permission check middleware
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    db.get(
      'SELECT * FROM role_permissions WHERE role = ? AND permission = ?',
      [req.user.role, permission],
      (err, perm) => {
        if (err || !perm) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
      }
    );
  };
};

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
            minecraft_username: minecraft_username || username
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
            post_count: user.post_count
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

// User routes
app.get('/api/users/profile/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT id, username, email, role, avatar, minecraft_username, bio, reputation, post_count, join_date, last_active, status FROM users WHERE id = ?',
    [id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    }
  );
});

app.put('/api/users/profile', authenticateToken, upload.single('avatar'), (req, res) => {
  const { bio, minecraft_username } = req.body;
  const avatar = req.file ? `avatars/${req.file.filename}` : null;
  
  let updateQuery = 'UPDATE users SET bio = ?, minecraft_username = ?';
  let params = [bio, minecraft_username];
  
  if (avatar) {
    updateQuery += ', avatar = ?';
    params.push(avatar);
  }
  
  updateQuery += ' WHERE id = ?';
  params.push(req.user.id);
  
  db.run(updateQuery, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Profile updated successfully' });
  });
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

app.post('/api/categories', authenticateToken, checkPermission('manage_categories'), (req, res) => {
  const { name, description, icon, color, parent_id, is_download_category } = req.body;
  
  db.run(
    'INSERT INTO categories (name, description, icon, color, parent_id, is_download_category) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description, icon, color, parent_id || null, is_download_category || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, message: 'Category created successfully' });
    }
  );
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
  const attachments = req.files ? req.files.map(file => `attachments/${file.filename}`) : [];
  
  if (!title || !content || !category_id) {
    return res.status(400).json({ error: 'Title, content, and category are required' });
  }
  
  db.run(
    'INSERT INTO posts (title, content, user_id, category_id, attachments, is_ticket, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, content, req.user.id, category_id, JSON.stringify(attachments), is_ticket || 0, priority || 'normal'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update user post count
      db.run('UPDATE users SET post_count = post_count + 1 WHERE id = ?', [req.user.id]);
      
      res.json({ id: this.lastID, message: 'Post created successfully' });
    }
  );
});

app.put('/api/posts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, content, solved } = req.body;
  
  db.run(
    'UPDATE posts SET title = ?, content = ?, solved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [title, content, solved || 0, id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }
      res.json({ message: 'Post updated successfully' });
    }
  );
});

app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM posts WHERE id = ? AND (user_id = ? OR ? IN ("admin", "moderator"))',
    [id, req.user.id, req.user.role],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }
      res.json({ message: 'Post deleted successfully' });
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

app.put('/api/comments/:id/hide', authenticateToken, checkPermission('manage_posts'), (req, res) => {
  const { id } = req.params;
  const { hidden } = req.body;
  
  db.run(
    'UPDATE comments SET hidden = ? WHERE id = ?',
    [hidden ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Comment updated successfully' });
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
  `;
  
  const conditions = [];
  const params = [];
  
  if (category) {
    conditions.push('d.category = ?');
    params.push(category);
  }
  
  if (search) {
    conditions.push('(d.name LIKE ? OR d.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (featured) {
    conditions.push('d.featured = 1');
  }
  
  conditions.push('d.approved = 1');
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
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

app.post('/api/downloads', authenticateToken, upload.single('file'), (req, res) => {
  const { name, description, category, version, minecraft_version, tags } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }
  
  if (!name || !description || !category) {
    return res.status(400).json({ error: 'Name, description, and category are required' });
  }
  
  db.run(
    'INSERT INTO downloads (name, description, file_path, file_size, category, user_id, version, minecraft_version, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, description, `downloads/${req.file.filename}`, req.file.size, category, req.user.id, version, minecraft_version, tags],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, message: 'Download created successfully' });
    }
  );
});

app.get('/api/downloads/:id/download', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM downloads WHERE id = ? AND approved = 1', [id], (err, download) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }
    
    // Update download count
    db.run('UPDATE downloads SET downloads = downloads + 1 WHERE id = ?', [id]);
    
    const filePath = join(__dirname, '../../uploads', download.file_path);
    res.download(filePath, download.name);
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

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Notification marked as read' });
    }
  );
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

// Admin routes
app.get('/api/admin/users', authenticateToken, checkPermission('manage_users'), (req, res) => {
  db.all('SELECT id, username, email, role, status, minecraft_username, post_count, reputation, banned, ban_reason, created_at, last_active FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

app.put('/api/admin/users/:id', authenticateToken, checkPermission('manage_users'), (req, res) => {
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

app.put('/api/admin/posts/:id/pin', authenticateToken, checkPermission('pin_posts'), (req, res) => {
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

app.put('/api/admin/posts/:id/lock', authenticateToken, checkPermission('lock_posts'), (req, res) => {
  const { id } = req.params;
  const { locked } = req.body;
  
  db.run(
    'UPDATE posts SET locked = ? WHERE id = ?',
    [locked ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Post lock status updated' });
    }
  );
});

app.put('/api/admin/downloads/:id/approve', authenticateToken, checkPermission('manage_downloads'), (req, res) => {
  const { id } = req.params;
  const { approved, featured } = req.body;
  
  db.run(
    'UPDATE downloads SET approved = ?, featured = ? WHERE id = ?',
    [approved ? 1 : 0, featured ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Download status updated' });
    }
  );
});

// Statistics routes
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  // Get user count
  db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.users = result.count;
    
    // Get post count
    db.get('SELECT COUNT(*) as count FROM posts', (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.posts = result.count;
      
      // Get download count
      db.get('SELECT COUNT(*) as count FROM downloads WHERE approved = 1', (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.downloads = result.count;
        
        // Get online users
        db.get('SELECT COUNT(*) as count FROM users WHERE status = "online"', (err, result) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.online = result.count;
          
          res.json(stats);
        });
      });
    });
  });
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 AESUCVAT Forum Server running on port ${PORT}`);
    console.log(`📊 Database: SQLite (database.db)`);
    console.log(`🔐 Admin credentials: admin / admin123`);
    console.log(`🛡️  Moderator credentials: moderator / mod123`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});