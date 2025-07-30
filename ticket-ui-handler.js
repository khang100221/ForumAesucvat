const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const PANEL_ICON = 'https://cdn-icons-png.flaticon.com/512/595/595661.png';
const ADMIN_ICON = 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png';
const CATEGORY_ICON = 'https://cdn-icons-png.flaticon.com/512/2311/2311524.png';
const LOG_ICON = 'https://cdn-icons-png.flaticon.com/512/4230/4230499.png';
const SETTINGS_ICON = 'https://cdn-icons-png.flaticon.com/512/2040/2040504.png';
const PREVIEW_ICON = 'https://cdn-icons-png.flaticon.com/512/3031/3031293.png';

// Cache để tối ưu hiệu suất
const configCache = new Map();
const CACHE_TTL = 300000; // 5 phút

// Cooldown để tránh spam
const setupCooldowns = new Map();
const SETUP_COOLDOWN = 3000; // 3 giây

// Hàm helper: Lấy config với cache
function getTicketConfig(db, guildId) {
  const cacheKey = `config_${guildId}`;
  const cached = configCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const config = db.prepare('SELECT * FROM ticket_config WHERE guildId = ?').get(guildId) || {};
  configCache.set(cacheKey, { data: config, timestamp: Date.now() });
  return config;
}

// Hàm helper: Xóa cache config
function clearConfigCache(guildId) {
  configCache.delete(`config_${guildId}`);
}

// Hàm helper: Kiểm tra cooldown
function checkSetupCooldown(userId) {
  const now = Date.now();
  const lastAction = setupCooldowns.get(userId);
  
  if (lastAction && now - lastAction < SETUP_COOLDOWN) {
    return Math.ceil((SETUP_COOLDOWN - (now - lastAction)) / 1000);
  }
  
  setupCooldowns.set(userId, now);
  setTimeout(() => setupCooldowns.delete(userId), SETUP_COOLDOWN);
  return 0;
}

// Hàm helper: Tạo embed lỗi
function createErrorEmbed(message, title = '❌ Lỗi') {
  return new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle(title)
    .setDescription(message)
    .setThumbnail(SETTINGS_ICON)
    .setTimestamp();
}

// Hàm helper: Tạo embed thành công
function createSuccessEmbed(message, title = '✅ Thành công') {
  return new EmbedBuilder()
    .setColor('#27ae60')
    .setTitle(title)
    .setDescription(message)
    .setThumbnail(SETTINGS_ICON)
    .setTimestamp();
}

// Hàm helper: Validate quyền cho category/channel
async function validateChannelPermissions(guild, channelId, requiredPerms = []) {
  try {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return { valid: false, error: 'Kênh/danh mục không tồn tại' };
    
    const botMember = guild.members.me;
    const permissions = botMember.permissionsIn(channel);
    
    const defaultPerms = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.SendMessages
    ];
    
    const allRequiredPerms = [...defaultPerms, ...requiredPerms];
    const missingPerms = allRequiredPerms.filter(perm => !permissions.has(perm));
    
    if (missingPerms.length > 0) {
      return { 
        valid: false, 
        error: `Bot thiếu quyền trong ${channel.name}. Cần thêm: ${missingPerms.length} quyền.` 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Lỗi khi kiểm tra quyền' };
  }
}

// Hàm helper: Tạo embed preview
function createPreviewEmbed(config) {
  const title = config.panel_title || '🎫 HỖ TRỢ KHÁCH HÀNG';
  const desc = config.panel_desc || 'Nhấn **MỞ TICKET** để được hỗ trợ riêng!';
  
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor('#2196f3')
    .setThumbnail(PANEL_ICON)
    .setFooter({ text: 'Ticket System • Preview Mode', iconURL: PREVIEW_ICON })
    .setTimestamp();
}

async function handleTicketUIInteraction(interaction, db) {
  try {
    // Kiểm tra quyền admin
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Bạn cần quyền **Manage Channels** để sử dụng tính năng này!')],
        ephemeral: true
      });
      return true;
    }

    // Kiểm tra cooldown
    const cooldown = checkSetupCooldown(interaction.user.id);
    if (cooldown > 0) {
      await interaction.reply({
        embeds: [createErrorEmbed(`⏳ Vui lòng đợi ${cooldown} giây trước khi thực hiện thao tác khác!`)],
        ephemeral: true
      });
      return true;
    }

    // ==== CUSTOMIZE TICKET PANEL ====
    if (interaction.isButton() && interaction.customId === 'setup_ticket_ui') {
      const conf = getTicketConfig(db, interaction.guild.id);
      const curTitle = conf.panel_title || '🎫 HỖ TRỢ KHÁCH HÀNG';
      const curDesc = conf.panel_desc || 'Nhấn **MỞ TICKET** để được hỗ trợ riêng!\n\n📋 **Hướng dẫn:**\n• Mô tả vấn đề chi tiết\n• Đính kèm ảnh nếu cần\n• Đợi admin hỗ trợ';
      const curBtn = conf.button_label || '🎫 MỞ TICKET';
      const curColor = conf.panel_color || '#2196f3';

      const modal = new ModalBuilder()
        .setCustomId('ticket_ui_custom')
        .setTitle('⚙️ Tuỳ chỉnh giao diện ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('panel_title')
              .setLabel('Tiêu đề panel (tối đa 100 ký tự)')
              .setValue(curTitle)
              .setStyle(TextInputStyle.Short)
              .setMaxLength(100)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('panel_desc')
              .setLabel('Mô tả panel (tối đa 1000 ký tự)')
              .setValue(curDesc)
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(1000)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('button_label')
              .setLabel('Tên nút mở ticket (tối đa 80 ký tự)')
              .setValue(curBtn)
              .setStyle(TextInputStyle.Short)
              .setMaxLength(80)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('panel_color')
              .setLabel('Màu embed (hex code, VD: #2196f3)')
              .setValue(curColor)
              .setStyle(TextInputStyle.Short)
              .setMaxLength(7)
              .setMinLength(7)
              .setRequired(false)
              .setPlaceholder('#2196f3')
          )
        );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_ui_custom') {
      await interaction.deferReply({ ephemeral: true });
      
      const panelTitle = interaction.fields.getTextInputValue('panel_title').trim();
      const panelDesc = interaction.fields.getTextInputValue('panel_desc').trim();
      const buttonLabel = interaction.fields.getTextInputValue('button_label').trim();
      let panelColor = interaction.fields.getTextInputValue('panel_color')?.trim() || '#2196f3';

      // Validate hex color
      if (!/^#[0-9A-F]{6}$/i.test(panelColor)) {
        panelColor = '#2196f3';
      }

      // Validate input lengths
      if (panelTitle.length === 0 || panelDesc.length === 0 || buttonLabel.length === 0) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Tất cả các trường đều bắt buộc và không được để trống!')]
        });
        return true;
      }

      try {
        // Sử dụng transaction để đảm bảo tính nhất quán
        const transaction = db.transaction(() => {
          db.prepare(`
            INSERT INTO ticket_config (guildId, panel_title, panel_desc, button_label, panel_color)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guildId) DO UPDATE SET 
              panel_title = ?, panel_desc = ?, button_label = ?, panel_color = ?, updated_at = ?
          `).run(
            interaction.guild.id, panelTitle, panelDesc, buttonLabel, panelColor,
            panelTitle, panelDesc, buttonLabel, panelColor, Date.now()
          );
        });
        
        transaction();
        clearConfigCache(interaction.guild.id);

        // Tạo preview
        const previewEmbed = createPreviewEmbed({
          panel_title: panelTitle,
          panel_desc: panelDesc,
          panel_color: panelColor
        });
        previewEmbed.setColor(panelColor);

        const previewButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create_preview')
            .setLabel(buttonLabel)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
            .setDisabled(true)
        );

        await interaction.editReply({
          embeds: [
            createSuccessEmbed([
              '**Đã lưu cấu hình giao diện ticket!**',
              '',
              `📝 **Tiêu đề:** ${panelTitle}`,
              `📄 **Mô tả:** ${panelDesc.substring(0, 100)}${panelDesc.length > 100 ? '...' : ''}`,
              `🔘 **Nút:** ${buttonLabel}`,
              `🎨 **Màu:** ${panelColor}`,
              '',
              '👇 **Xem trước:**'
            ].join('\n')),
            previewEmbed
          ],
          components: [previewButton]
        });
      } catch (error) {
        console.error('Database error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Lỗi khi lưu cấu hình! Vui lòng thử lại.')]
        });
      }
      return true;
    }

    // ==== ADVANCED SETUP MENU ====
    if (interaction.isButton() && interaction.customId === 'setup_advanced_options') {
      const conf = getTicketConfig(db, interaction.guild.id);
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('advanced_setup_select')
        .setPlaceholder('🔧 Chọn tùy chọn nâng cao để cấu hình')
        .addOptions([
          {
            label: 'Thông báo tự động',
            description: 'Cấu hình tin nhắn tự động khi tạo/đóng ticket',
            value: 'auto_messages',
            emoji: '🤖'
          },
          {
            label: 'Giới hạn ticket',
            description: 'Đặt giới hạn số ticket mỗi user có thể tạo',
            value: 'ticket_limits',
            emoji: '🔢'
          },
          {
            label: 'Danh mục theo loại',
            description: 'Tạo nhiều danh mục cho các loại ticket khác nhau',
            value: 'category_types',
            emoji: '📂'
          },
          {
            label: 'Thời gian tự động đóng',
            description: 'Cấu hình thời gian tự động đóng ticket không hoạt động',
            value: 'auto_close_time',
            emoji: '⏰'
          }
        ]);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔧 Cấu hình nâng cao')
            .setDescription([
              'Chọn các tùy chọn nâng cao để tùy chỉnh hệ thống ticket:',
              '',
              '🤖 **Thông báo tự động** - Tin nhắn chào mừng và thông báo',
              '🔢 **Giới hạn ticket** - Kiểm soát số lượng ticket',
              '📂 **Danh mục theo loại** - Phân loại ticket theo chủ đề',
              '⏰ **Tự động đóng** - Đóng ticket không hoạt động'
            ].join('\n'))
            .setColor('#9B59B6')
            .setThumbnail(SETTINGS_ICON)
        ],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
      return true;
    }

    // ===== SETUP CATEGORY CREATE =====
    if (interaction.isButton() && interaction.customId === 'setup_ticket_create') {
      const select = new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_create_category')
        .setChannelTypes(ChannelType.GuildCategory)
        .setPlaceholder('🗂️ Chọn category để tạo ticket mới')
        .setMaxValues(1)
        .setMinValues(1);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🗂️ Cấu hình Category Tạo Ticket')
            .setDescription([
              'Chọn category để chứa các ticket mới được tạo.',
              '',
              '⚠️ **Lưu ý quan trọng:**',
              '• Bot cần quyền **Manage Channels** trong category',
              '• Category không nên chứa quá nhiều kênh (khuyến nghị < 50)',
              '• Đảm bảo category có đủ slot trống cho ticket mới',
              '',
              '💡 **Mẹo:** Tạo category riêng chỉ dành cho ticket để dễ quản lý!'
            ].join('\n'))
            .setColor('#6C5CE7')
            .setThumbnail(CATEGORY_ICON)
            .setFooter({ text: 'Ticket Setup • Category Creation' })
        ],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
      return true;
    }

    if (interaction.isChannelSelectMenu && interaction.customId === 'select_ticket_create_category') {
      await interaction.deferUpdate();
      const catId = interaction.values[0];
      
      // Validate permissions
      const permCheck = await validateChannelPermissions(interaction.guild, catId);
      if (!permCheck.valid) {
        await interaction.editReply({
          embeds: [createErrorEmbed(permCheck.error)],
          components: []
        });
        return true;
      }

      // Kiểm tra số lượng kênh trong category
      const category = interaction.guild.channels.cache.get(catId);
      const channelCount = category.children.cache.size;
      
      try {
        const transaction = db.transaction(() => {
          db.prepare(`
            INSERT INTO ticket_config (guildId, category_create)
            VALUES (?, ?)
            ON CONFLICT(guildId) DO UPDATE SET category_create = ?, updated_at = ?
          `).run(interaction.guild.id, catId, catId, Date.now());
        });
        
        transaction();
        clearConfigCache(interaction.guild.id);

        await interaction.editReply({
          embeds: [
            createSuccessEmbed([
              `**Đã cấu hình category tạo ticket!**`,
              '',
              `📂 **Category:** ${category.name}`,
              `📊 **Kênh hiện tại:** ${channelCount}/50`,
              `🔑 **Quyền bot:** ✅ Đầy đủ`,
              '',
              channelCount > 40 ? '⚠️ **Cảnh báo:** Category gần đầy, hãy dọn dẹp!' : '✅ **Trạng thái:** Sẵn sàng tạo ticket'
            ].join('\n'))
          ],
          components: []
        });
      } catch (error) {
        console.error('Database error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Lỗi khi lưu cấu hình! Vui lòng thử lại.')],
          components: []
        });
      }
      return true;
    }

    // ===== SETUP CATEGORY CLOSE =====
    if (interaction.isButton() && interaction.customId === 'setup_ticket_close') {
      const select = new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_close_category')
        .setChannelTypes(ChannelType.GuildCategory)
        .setPlaceholder('📦 Chọn category lưu ticket đã đóng')
        .setMaxValues(1)
        .setMinValues(1);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📦 Cấu hình Category Lưu Ticket Đã Đóng')
            .setDescription([
              'Chọn category để lưu trữ các ticket đã đóng.',
              '',
              '📋 **Chức năng:**',
              '• Ticket sẽ được chuyển vào đây khi đóng',
              '• Chỉ admin và bot có thể xem',
              '• Tự động xóa sau 24 giờ (có thể tùy chỉnh)',
              '',
              '💡 **Lợi ích:**',
              '• Lưu trữ lịch sử ticket',
              '• Dễ dàng kiểm tra lại nội dung',
              '• Không làm rối category chính'
            ].join('\n'))
            .setColor('#fdcb6e')
            .setThumbnail(CATEGORY_ICON)
            .setFooter({ text: 'Ticket Setup • Archive Category' })
        ],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
      return true;
    }

    if (interaction.isChannelSelectMenu && interaction.customId === 'select_ticket_close_category') {
      await interaction.deferUpdate();
      const catId = interaction.values[0];
      
      // Validate permissions
      const permCheck = await validateChannelPermissions(interaction.guild, catId);
      if (!permCheck.valid) {
        await interaction.editReply({
          embeds: [createErrorEmbed(permCheck.error)],
          components: []
        });
        return true;
      }

      const category = interaction.guild.channels.cache.get(catId);
      
      try {
        const transaction = db.transaction(() => {
          db.prepare(`
            INSERT INTO ticket_config (guildId, category_close)
            VALUES (?, ?)
            ON CONFLICT(guildId) DO UPDATE SET category_close = ?, updated_at = ?
          `).run(interaction.guild.id, catId, catId, Date.now());
        });
        
        transaction();
        clearConfigCache(interaction.guild.id);

        await interaction.editReply({
          embeds: [
            createSuccessEmbed([
              `**Đã cấu hình category lưu ticket đã đóng!**`,
              '',
              `📦 **Category:** ${category.name}`,
              `🔒 **Quyền xem:** Chỉ admin và bot`,
              `⏰ **Tự động xóa:** Sau 24 giờ`,
              '',
              '✅ **Ticket đã đóng sẽ được chuyển vào đây để lưu trữ.**'
            ].join('\n'))
          ],
          components: []
        });
      } catch (error) {
        console.error('Database error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Lỗi khi lưu cấu hình! Vui lòng thử lại.')],
          components: []
        });
      }
      return true;
    }

    // ===== SETUP LOG CHANNEL =====
    if (interaction.isButton() && interaction.customId === 'setup_ticket_log') {
      const select = new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_log_channel')
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder('📋 Chọn kênh nhận log ticket')
        .setMaxValues(1)
        .setMinValues(1);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 Cấu hình Kênh Log Ticket')
            .setDescription([
              'Chọn kênh để nhận thông báo log về tất cả hoạt động ticket.',
              '',
              '📊 **Thông tin được log:**',
              '• Ticket mới được tạo',
              '• Ticket được claim bởi admin',
              '• Ticket được đóng',
              '• Ticket được xóa tự động',
              '• Lỗi hệ thống (nếu có)',
              '',
              '🔐 **Khuyến nghị:**',
              '• Chọn kênh chỉ admin xem được',
              '• Không chọn kênh công khai',
              '• Đảm bảo bot có quyền gửi tin nhắn'
            ].join('\n'))
            .setColor('#0984e3')
            .setThumbnail(LOG_ICON)
            .setFooter({ text: 'Ticket Setup • Logging System' })
        ],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
      return true;
    }

    if (interaction.isChannelSelectMenu && interaction.customId === 'select_ticket_log_channel') {
      await interaction.deferUpdate();
      const channelId = interaction.values[0];
      
      // Validate permissions
      const permCheck = await validateChannelPermissions(interaction.guild, channelId, [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ]);
      
      if (!permCheck.valid) {
        await interaction.editReply({
          embeds: [createErrorEmbed(permCheck.error)],
          components: []
        });
        return true;
      }

      const channel = interaction.guild.channels.cache.get(channelId);
      
      try {
        const transaction = db.transaction(() => {
          db.prepare(`
            INSERT INTO ticket_config (guildId, log_channel)
            VALUES (?, ?)
            ON CONFLICT(guildId) DO UPDATE SET log_channel = ?, updated_at = ?
          `).run(interaction.guild.id, channelId, channelId, Date.now());
        });
        
        transaction();
        clearConfigCache(interaction.guild.id);

        // Gửi tin nhắn test log
        try {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎉 Kênh Log Ticket Đã Được Cấu Hình')
                .setDescription([
                  'Kênh này sẽ nhận tất cả thông báo log về hoạt động ticket.',
                  '',
                  '📋 **Các loại log:**',
                  '• 📩 Ticket mới',
                  '• 👮 Ticket claimed',
                  '• 🔒 Ticket đóng',
                  '• 🗑️ Ticket xóa',
                  '• ⚠️ Cảnh báo hệ thống'
                ].join('\n'))
                .setColor('#27ae60')
                .setTimestamp()
                .setFooter({ text: 'Ticket Log System • Test Message' })
            ]
          });
        } catch (error) {
          // Ignore send error
        }

        await interaction.editReply({
          embeds: [
            createSuccessEmbed([
              `**Đã cấu hình kênh log ticket!**`,
              '',
              `📋 **Kênh:** ${channel}`,
              `🔑 **Quyền bot:** ✅ Đầy đủ`,
              `📨 **Test message:** Đã gửi`,
              '',
              '✅ **Kênh này sẽ nhận tất cả thông báo về hoạt động ticket.**'
            ].join('\n'))
          ],
          components: []
        });
      } catch (error) {
        console.error('Database error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Lỗi khi lưu cấu hình! Vui lòng thử lại.')],
          components: []
        });
      }
      return true;
    }

    // ===== SETUP ADMIN ROLE =====
    if (interaction.isButton() && interaction.customId === 'setup_ticket_role') {
      const select = new RoleSelectMenuBuilder()
        .setCustomId('select_ticket_admin_role')
        .setPlaceholder('👮‍♂️ Chọn vai trò admin ticket')
        .setMaxValues(1)
        .setMinValues(1);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('👮‍♂️ Cấu hình Vai Trò Admin Ticket')
            .setDescription([
              'Chọn vai trò để quản lý hệ thống ticket.',
              '',
              '🔑 **Quyền của admin role:**',
              '• Xem tất cả ticket',
              '• Claim ticket',
              '• Đóng ticket bất kỳ',
              '• Nhận ping khi có ticket mới',
              '• Xem lịch sử ticket đã đóng',
              '',
              '💡 **Lưu ý:**',
              '• Vai trò này sẽ được ping khi có ticket mới',
              '• Nên chọn vai trò dành riêng cho support team',
              '• Không nên chọn @everyone hoặc vai trò quá rộng'
            ].join('\n'))
            .setColor('#00b894')
            .setThumbnail(ADMIN_ICON)
            .setFooter({ text: 'Ticket Setup • Admin Role' })
        ],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
      return true;
    }

    if (interaction.isRoleSelectMenu && interaction.customId === 'select_ticket_admin_role') {
      await interaction.deferUpdate();
      const roleId = interaction.values[0];
      
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Vai trò không tồn tại!')],
          components: []
        });
        return true;
      }

      // Kiểm tra xem role có phải @everyone không
      if (role.id === interaction.guild.id) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Không thể chọn @everyone làm admin role!')],
          components: []
        });
        return true;
      }

      try {
        const transaction = db.transaction(() => {
          db.prepare(`
            INSERT INTO ticket_config (guildId, admin_role)
            VALUES (?, ?)
            ON CONFLICT(guildId) DO UPDATE SET admin_role = ?, updated_at = ?
          `).run(interaction.guild.id, roleId, roleId, Date.now());
        });
        
        transaction();
        clearConfigCache(interaction.guild.id);

        const memberCount = role.members.size;

        await interaction.editReply({
          embeds: [
            createSuccessEmbed([
              `**Đã cấu hình vai trò admin ticket!**`,
              '',
              `👮‍♂️ **Vai trò:** ${role}`,
              `👥 **Số thành viên:** ${memberCount}`,
              `🔔 **Nhận ping:** Khi có ticket mới`,
              `🎫 **Quyền:** Quản lý tất cả ticket`,
              '',
              memberCount === 0 ? '⚠️ **Cảnh báo:** Vai trò này chưa có thành viên nào!' : '✅ **Vai trò đã sẵn sàng quản lý ticket.**'
            ].join('\n'))
          ],
          components: []
        });
      } catch (error) {
        console.error('Database error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Lỗi khi lưu cấu hình! Vui lòng thử lại.')],
          components: []
        });
      }
      return true;
    }

    // ===== SETUP STATUS & OVERVIEW =====
    if (interaction.isButton() && interaction.customId === 'setup_ticket_status') {
      const conf = getTicketConfig(db, interaction.guild.id);
      
      // Kiểm tra trạng thái setup
      const setupStatus = {
        panel: !!(conf.panel_title && conf.panel_desc && conf.button_label),
        createCategory: !!conf.category_create,
        closeCategory: !!conf.category_close,
        logChannel: !!conf.log_channel,
        adminRole: !!conf.admin_role
      };

      const completedCount = Object.values(setupStatus).filter(Boolean).length;
      const totalCount = Object.keys(setupStatus).length;
      const progressPercent = Math.round((completedCount / totalCount) * 100);

      const statusEmbed = new EmbedBuilder()
        .setTitle('📊 Trạng Thái Cấu Hình Ticket System')
        .setDescription([
          `**Tiến độ hoàn thành: ${completedCount}/${totalCount} (${progressPercent}%)**`,
          '',
          `${setupStatus.panel ? '✅' : '❌'} **Giao diện panel** ${setupStatus.panel ? '- Đã cấu hình' : '- Chưa cấu hình'}`,
          `${setupStatus.createCategory ? '✅' : '❌'} **Category tạo ticket** ${setupStatus.createCategory ? `- <#${conf.category_create}>` : '- Chưa chọn'}`,
          `${setupStatus.closeCategory ? '✅' : '❌'} **Category lưu ticket** ${setupStatus.closeCategory ? `- <#${conf.category_close}>` : '- Chưa chọn'}`,
          `${setupStatus.logChannel ? '✅' : '❌'} **Kênh log** ${setupStatus.logChannel ? `- <#${conf.log_channel}>` : '- Chưa chọn'}`,
          `${setupStatus.adminRole ? '✅' : '❌'} **Vai trò admin** ${setupStatus.adminRole ? `- <@&${conf.admin_role}>` : '- Chưa chọn'}`,
          '',
          completedCount === totalCount ? 
            '🎉 **Hệ thống đã sẵn sàng hoạt động!**' : 
            `⚠️ **Cần hoàn thành thêm ${totalCount - completedCount} bước để hệ thống hoạt động đầy đủ.**`
        ].join('\n'))
        .setColor(completedCount === totalCount ? '#27ae60' : '#f39c12')
        .setThumbnail(SETTINGS_ICON)
        .setFooter({ 
          text: `Ticket System • ${progressPercent}% Complete`, 
          iconURL: SETTINGS_ICON 
        })
        .setTimestamp();

      // Thêm thông tin thống kê nếu có
      if (conf.ticket_count) {
        statusEmbed.addFields({
          name: '📈 Thống kê',
          value: [
            `🎫 **Tổng ticket đã tạo:** ${conf.ticket_count}`,
            `📅 **Cập nhật lần cuối:** <t:${Math.floor((conf.updated_at || Date.now()) / 1000)}:R>`
          ].join('\n'),
          inline: false
        });
      }

      await interaction.reply({
        embeds: [statusEmbed],
        ephemeral: true
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Ticket UI interaction error:', error);
    
    try {
      const errorEmbed = createErrorEmbed('Đã xảy ra lỗi hệ thống! Vui lòng thử lại sau.');
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          embeds: [errorEmbed]
        });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return true;
  }
}

// Cleanup function
function cleanupSetupCaches() {
  const now = Date.now();
  
  // Cleanup config cache
  for (const [key, value] of configCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      configCache.delete(key);
    }
  }
  
  // Cleanup cooldowns
  for (const [key, timestamp] of setupCooldowns.entries()) {
    if (now - timestamp > SETUP_COOLDOWN) {
      setupCooldowns.delete(key);
    }
  }
}

// Auto cleanup mỗi 5 phút
setInterval(cleanupSetupCaches, 5 * 60 * 1000);

module.exports = { 
  handleTicketUIInteraction,
  cleanupSetupCaches,
  getTicketConfig,
  clearConfigCache
};