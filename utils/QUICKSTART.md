# 🚀 Quick Start Guide

## ⚡ Sử Dụng Ngay Lập Tức

### 1. Copy File
```bash
# Copy file chính vào project của bạn
cp utils/ticketSystem.cjs your-project/utils/ticketSystem.js
```

### 2. Import & Use
```javascript
// Trong main bot file (index.js, bot.js, etc.)
const { handleTicketInteraction } = require('./utils/ticketSystem');

// Trong event handler
client.on('interactionCreate', async (interaction) => {
  // Xử lý ticket interactions
  if (await handleTicketInteraction(interaction, db)) {
    return; // Ticket đã được xử lý
  }
  
  // Xử lý các interactions khác...
});
```

### 3. Database Setup (Nếu Chưa Có)
```sql
-- Tạo bảng cấu hình ticket
CREATE TABLE IF NOT EXISTS ticket_config (
    guildId TEXT PRIMARY KEY,
    category_create TEXT,
    category_close TEXT,
    log_channel TEXT,
    admin_role TEXT,
    ticket_count INTEGER DEFAULT 0
);

-- Tạo bảng log ticket
CREATE TABLE IF NOT EXISTS ticket_logs (
    ticketId TEXT,
    guildId TEXT,
    userId TEXT,
    logText TEXT,
    PRIMARY KEY (ticketId, guildId)
);
```

### 4. Cấu Hình Server
```javascript
// Ví dụ setup command
client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'ticket-setup') {
    // Lưu cấu hình vào database
    db.prepare(`
      INSERT OR REPLACE INTO ticket_config 
      (guildId, category_create, category_close, log_channel, admin_role) 
      VALUES (?, ?, ?, ?, ?)
    `).run(
      interaction.guild.id,
      categoryCreateId,
      categoryCloseId,
      logChannelId,
      adminRoleId
    );
  }
});
```

## 🎫 Tạo Ticket Button

```javascript
// Tạo embed với button tạo ticket
const embed = new EmbedBuilder()
  .setTitle('🎫 Hỗ Trợ Ticket')
  .setDescription('Nhấn button bên dưới để tạo ticket hỗ trợ')
  .setColor('#2196f3');

const button = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('🎫 Tạo Ticket')
      .setStyle(ButtonStyle.Primary)
  );

await channel.send({
  embeds: [embed],
  components: [button]
});
```

## ✅ Hoàn Thành!

Bây giờ hệ thống ticket đã sẵn sàng hoạt động với:

- ✅ Tạo ticket tự động
- ✅ Claim ticket cho admin
- ✅ Đóng ticket với lý do
- ✅ Lưu lịch sử trò chuyện
- ✅ Rate limiting chống spam
- ✅ Error handling tốt
- ✅ Performance tối ưu

## 🔧 Troubleshooting

### Bot không phản hồi?
1. Kiểm tra permissions bot
2. Kiểm tra database connection
3. Xem console logs

### Database error?
1. Chạy SQL setup commands
2. Kiểm tra file database tồn tại
3. Verify table structure

### Need help?
- Đọc `README.md` để hiểu chi tiết
- Chạy `node validate.cjs` để kiểm tra
- Check console logs for errors

**🎉 Chúc bạn thành công!**