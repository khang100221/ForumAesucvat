require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  ActivityType,
  Events,
  InteractionType,
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const { handleQRMenu } = require('./utils/qrHandler');
const { handleNukeInteraction } = require('./utils/nukeHandler');

// --- Thêm cột relatedUserId cho bảng history nếu chưa có ---
try {
  const colExists = db => {
    const res = db.prepare("PRAGMA table_info(history)").all();
    return res.some(col => col.name === 'relatedUserId');
  };
  const db = new Database('./database.sqlite');
  if (!colExists(db)) {
    db.prepare('ALTER TABLE history ADD COLUMN relatedUserId TEXT').run();
    console.log('[DATABASE] Đã thêm cột relatedUserId vào bảng history');
  }
  db.close();
} catch (e) {
  if (!/duplicate column/i.test(e.message)) {
    console.error('[DATABASE] Lỗi khi thêm cột relatedUserId:', e.message);
  }
}
// --- END thêm cột ---

const db = new Database('./database.sqlite');

// Tối ưu database performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('temp_store = MEMORY');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    game TEXT NOT NULL,
    price TEXT NOT NULL,
    capetype TEXT DEFAULT '[]',
    rank TEXT,
    note TEXT,
    status TEXT DEFAULT 'available',
    uploaded_by TEXT,
    uploaded_at TEXT,
    buyer TEXT,
    sold_by TEXT,
    sold_at TEXT,
    messageId TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    lastCoinflip TEXT,
    luck_potion INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    loses INTEGER DEFAULT 0,
    legit INTEGER DEFAULT 0,
    lastDaily TEXT
  );
  CREATE TABLE IF NOT EXISTS item_inventory (
    userId TEXT,
    itemId TEXT,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (userId, itemId)
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    type TEXT,
    amount INTEGER,
    time TEXT,
    note TEXT,
    relatedUserId TEXT
  );
  CREATE TABLE IF NOT EXISTS legit_channels (
    guildId TEXT PRIMARY KEY,
    channelId TEXT
  );
  CREATE TABLE IF NOT EXISTS ticket_config (
    guildId TEXT PRIMARY KEY,
    category_create TEXT,
    category_close TEXT,
    log_channel TEXT,
    admin_role TEXT,
    ticket_count INTEGER DEFAULT 0,
    panel_title TEXT,
    panel_desc TEXT,
    button_label TEXT,
    panel_channel TEXT,
    panel_message_id TEXT
  );
  CREATE TABLE IF NOT EXISTS kvstore (
    id TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS ticket_logs (
    ticketId TEXT,
    guildId TEXT,
    userId TEXT,
    logText TEXT,
    PRIMARY KEY (ticketId, guildId)
  );
  CREATE TABLE IF NOT EXISTS nuke_logs (
    user_id TEXT, username TEXT, old_channel_id TEXT, new_channel_id TEXT, channel_name TEXT, timestamp TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_status ON accounts (status);
  CREATE INDEX IF NOT EXISTS idx_uploaded_at ON accounts (uploaded_at);
  CREATE INDEX IF NOT EXISTS idx_history_user ON history (userId);
  CREATE INDEX IF NOT EXISTS idx_history_time ON history (time);
`);

try {
  db.prepare('ALTER TABLE ticket_config ADD COLUMN panel_message_id TEXT').run();
  console.log('[DATABASE] Added panel_message_id column to ticket_config');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('[DATABASE] panel_message_id column already exists');
  } else {
    console.error('[DATABASE ERROR] Failed to add panel_message_id column:', e.message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
const interactionCooldown = new Map();

// Performance monitoring
let interactionCount = 0;
let errorCount = 0;
const startTime = Date.now();

async function walk(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results.push(...await walk(fullPath));
    } else if (file.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = await walk(commandsPath);
  let loadedCount = 0;
  
  for (const file of commandFiles) {
    try {
      const command = require(file);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`[INFO] Đã tải lệnh: ${command.data.name} từ ${file}`);
        loadedCount++;
      } else {
        console.warn(`[WARN] Lệnh không hợp lệ: ${file}`);
      }
    } catch (error) {
      console.error(`[ERROR] Lỗi khi tải lệnh ${file}:`, error);
    }
  }
  
  console.log(`[INFO] Đã tải ${loadedCount} lệnh thành công`);
}

async function setDynamicStatus() {
  try {
    const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const totalGuilds = client.guilds.cache.size;
    const uptime = Math.floor((Date.now() - startTime) / 1000 / 60); // minutes
    
    const statuses = [
      `/help | ${totalGuilds} sv | ${totalUsers} thành viên`,
      `🎫 Ticket System v2.0 | Uptime: ${uptime}m`,
      `💰 Shop System | ${interactionCount} interactions`,
      `⚡ Performance: ${errorCount} errors`
    ];
    
    const status = statuses[Math.floor(Date.now() / 30000) % statuses.length];
    client.user.setActivity(status, { type: ActivityType.Watching });
  } catch (error) {
    console.error('[INDEX DEBUG] Lỗi khi cập nhật status:', error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
  console.log('🎫 Hệ thống ticket cải tiến v2.0 đã được tích hợp');
  console.log('⚡ Database performance optimizations enabled');
  
  await loadCommands();
  await setDynamicStatus();
  setInterval(setDynamicStatus, 30 * 1000); // 30 seconds
  
  // Performance monitoring
  setInterval(() => {
    const memUsage = process.memoryUsage();
    console.log(`[PERFORMANCE] Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB | Interactions: ${interactionCount} | Errors: ${errorCount}`);
  }, 5 * 60 * 1000); // 5 minutes
});

const messageCreate = require('./events/messageCreate');
const { shopHandler } = require('./utils/shopHandler');
// Import hệ thống ticket cải tiến v2.0
const { handleTicketInteraction } = require('./utils/ticketSystem.cjs');
const { handleTicketUIInteraction } = require('./utils/ticketSetupUI');

client.on(Events.InteractionCreate, async interaction => {
  interactionCount++;
  
  try {
    const interactionKey = `${interaction.user.id}:${interaction.commandName || interaction.customId || 'unknown'}`;
    const cooldownTime = interactionCooldown.get(interactionKey);
    
    if (cooldownTime && Date.now() < cooldownTime) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [
            {
              color: 0xE74C3C,
              title: '⏳ Vui Lòng Chờ',
              description: `Bạn đang thao tác quá nhanh! Vui lòng thử lại sau ${Math.ceil((cooldownTime - Date.now()) / 1000)} giây.`,
              thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/4332/4332637.png' },
              footer: { text: 'Shop System v2.0', icon_url: 'https://cdn-icons-png.flaticon.com/512/4332/4332637.png' },
              timestamp: new Date().toISOString(),
            },
          ],
          ephemeral: true,
        });
      }
      return;
    }
    
    interactionCooldown.set(interactionKey, Date.now() + 2000);
    setTimeout(() => interactionCooldown.delete(interactionKey), 2000);

    // Nuke interactions
    if (
      interaction.isButton() &&
      (interaction.customId === 'confirm_nuke' || interaction.customId === 'cancel_nuke')
    ) {
      if (await handleNukeInteraction(interaction, db)) return;
    }

    // Chat input commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Lệnh không tồn tại!', ephemeral: true });
        }
        return;
      }
      
      console.log(`[COMMAND] ${interaction.user.tag} used /${interaction.commandName} in ${interaction.guild?.name || 'DM'}`);
      
      if (command.execute.length >= 2) {
        await command.execute(interaction, db);
      } else {
        await command.execute(interaction);
      }
      return;
    }

    // Component interactions (buttons, selects, modals, etc.)
    if (
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isModalSubmit() ||
      interaction.isChannelSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isUserSelectMenu()
    ) {
      console.log(`[INTERACTION] Xử lý ${InteractionType[interaction.type]}: ${interaction.customId || 'N/A'} bởi ${interaction.user.tag} trong ${interaction.guild?.name || 'DM'}`);

      // Deprecated qrHandler
      if (interaction.customId === 'qrHandler') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Tương tác qrHandler không còn được hỗ trợ. Vui lòng sử dụng lệnh /qr mới.',
            ephemeral: true,
          });
        }
        return;
      }

      // Xử lý theo thứ tự ưu tiên - handlers return true nếu đã xử lý
      const handlers = [
        { name: 'QR Menu', handler: () => handleQRMenu(interaction, db) },
        { name: 'Ticket UI', handler: () => handleTicketUIInteraction(interaction, db) },
        { name: 'Ticket System v2.0', handler: () => handleTicketInteraction(interaction, db) },
        { name: 'Shop Handler', handler: () => shopHandler(interaction, db) },
      ];

      for (const { name, handler } of handlers) {
        try {
          if (await handler()) {
            console.log(`[SUCCESS] ${name} handled interaction: ${interaction.customId}`);
            return;
          }
        } catch (error) {
          console.error(`[ERROR] ${name} failed to handle interaction:`, error);
          errorCount++;
          // Continue to next handler
        }
      }

      // Duel command special handling
      const duelCommand = client.commands.get('duel');
      if (
        duelCommand &&
        typeof duelCommand.handleInteraction === 'function' &&
        interaction.customId &&
        (
          interaction.customId.startsWith('duel_select_') ||
          interaction.customId.startsWith('accept_duel_') ||
          interaction.customId.startsWith('decline_duel_')
        )
      ) {
        try {
          await duelCommand.handleInteraction(interaction, db);
          console.log(`[SUCCESS] Duel command handled interaction: ${interaction.customId}`);
          return;
        } catch (error) {
          console.error('[ERROR] Duel command failed:', error);
          errorCount++;
        }
      }

      // Fallback - no handler processed this interaction
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: '❌ Tương tác không được hỗ trợ!', 
          ephemeral: true 
        });
      }
      return;
    }

    // Fallback cho loại interaction không được hỗ trợ
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: '❌ Loại tương tác này không được hỗ trợ!', 
        ephemeral: true 
      });
    }
    
  } catch (error) {
    errorCount++;
    
    // Đúng chuẩn: Không cố reply lần nữa nếu đã handled hoặc lỗi đã hết hạn
    const errorCode = error.code || error?.rawError?.code;
    if (errorCode === 10062 || errorCode === 40060) {
      console.warn('[WARN] Interaction expired or already handled:', errorCode, error.message);
      return;
    }
    
    // Các lỗi khác thì báo lỗi ra log và gửi thông báo cho user nếu còn chưa handled
    console.error('[ERROR] Xử lý interaction:', {
      type: InteractionType[interaction.type],
      customId: interaction.customId || 'N/A',
      commandName: interaction.commandName || 'N/A',
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [
            {
              color: 0xE74C3C,
              title: '❌ Lỗi Hệ Thống',
              description: 'Đã xảy ra lỗi khi xử lý tương tác. Vui lòng thử lại sau.',
              fields: [
                {
                  name: '🔧 Thông tin lỗi',
                  value: `Loại: ${InteractionType[interaction.type]}\nID: \`${interaction.customId || interaction.commandName || 'N/A'}\``,
                  inline: false
                }
              ],
              thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/4332/4332637.png' },
              footer: { text: 'Ticket System v2.0', icon_url: 'https://cdn-icons-png.flaticon.com/512/4332/4332637.png' },
              timestamp: new Date().toISOString(),
            },
          ],
          ephemeral: true,
        });
      }
    } catch (err) {
      // Nếu vẫn lỗi (hết hạn), chỉ log
      const subErrCode = err.code || err?.rawError?.code;
      if (subErrCode !== 10062 && subErrCode !== 40060) {
        console.error('[ERROR] Không thể gửi phản hồi lỗi:', err);
      }
    }
  }
});

client.on('messageCreate', async msg => {
  console.log(`[INDEX DEBUG] messageCreate triggered for message ${msg.id} in channel ${msg.channel.id} at ${new Date().toISOString()}`);
  try {
    await messageCreate(msg, db);
  } catch (error) {
    console.error('[INDEX ERROR] Xử lý messageCreate:', error);
    errorCount++;
  }
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  errorCount++;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  errorCount++;
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[INFO] Received SIGINT, shutting down gracefully...');
  db.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[INFO] Received SIGTERM, shutting down gracefully...');
  db.close();
  client.destroy();
  process.exit(0);
});

// Log to confirm listener registration
console.log('[INDEX DEBUG] Registered messageCreate listener');
console.log('[INDEX DEBUG] Registered error handlers');

client.login(process.env.TOKEN).catch(error => {
  console.error('[ERROR] Đăng nhập bot thất bại:', error);
  process.exit(1);
});