const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const TICKET_ICON = 'https://cdn-icons-png.flaticon.com/512/4332/4332637.png';

// Cải tiến: Sử dụng Map để quản lý cooldown tốt hơn
const ticketCooldowns = new Map();
const COOLDOWN_TIME = 5000; // 5 giây

// Cải tiến: Thêm cache để tối ưu hiệu suất
const configCache = new Map();
const CACHE_TTL = 300000; // 5 phút

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
function checkCooldown(userId, action) {
  const key = `${userId}_${action}`;
  const now = Date.now();
  const lastAction = ticketCooldowns.get(key);
  
  if (lastAction && now - lastAction < COOLDOWN_TIME) {
    return Math.ceil((COOLDOWN_TIME - (now - lastAction)) / 1000);
  }
  
  ticketCooldowns.set(key, now);
  // Tự động xóa sau cooldown để tránh memory leak
  setTimeout(() => ticketCooldowns.delete(key), COOLDOWN_TIME);
  return 0;
}

// Hàm helper: Validate permissions
async function validateBotPermissions(guild, categoryId) {
  try {
    const category = guild.channels.cache.get(categoryId);
    if (!category) return { valid: false, error: 'Danh mục không tồn tại' };
    
    const botMember = guild.members.me;
    const permissions = botMember.permissionsIn(category);
    
    const requiredPerms = [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageRoles
    ];
    
    const missingPerms = requiredPerms.filter(perm => !permissions.has(perm));
    
    if (missingPerms.length > 0) {
      return { 
        valid: false, 
        error: `Bot thiếu quyền: ${missingPerms.map(p => p.toString()).join(', ')}` 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Lỗi khi kiểm tra quyền bot' };
  }
}

// Hàm helper: Tạo embed lỗi
function createErrorEmbed(message, title = '❌ Lỗi') {
  return new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle(title)
    .setDescription(message)
    .setThumbnail(TICKET_ICON)
    .setTimestamp();
}

// Hàm helper: Tạo embed thành công
function createSuccessEmbed(message, title = '✅ Thành công') {
  return new EmbedBuilder()
    .setColor('#43ea3a')
    .setTitle(title)
    .setDescription(message)
    .setThumbnail(TICKET_ICON)
    .setTimestamp();
}

async function handleTicketInteraction(interaction, db) {
  try {
    // --- TẠO TICKET ---
    if (interaction.isButton() && interaction.customId === 'ticket_create') {
      // Kiểm tra cooldown
      const cooldown = checkCooldown(interaction.user.id, 'create_ticket');
      if (cooldown > 0) {
        await interaction.reply({
          embeds: [createErrorEmbed(`⏳ Vui lòng đợi ${cooldown} giây trước khi tạo ticket mới!`)],
          ephemeral: true
        });
        return true;
      }

      await interaction.deferReply({ ephemeral: true });

      const conf = getTicketConfig(db, interaction.guild.id);
      
      // Cải tiến: Kiểm tra setup đầy đủ hơn
      if (!conf.category_create) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Ticket chưa được setup danh mục tạo! Vui lòng liên hệ admin để cấu hình.')]
        });
        return true;
      }

      // Cải tiến: Validate quyền bot chi tiết hơn
      const permCheck = await validateBotPermissions(interaction.guild, conf.category_create);
      if (!permCheck.valid) {
        await interaction.editReply({
          embeds: [createErrorEmbed(permCheck.error)]
        });
        return true;
      }

      // Cải tiến: Kiểm tra ticket tồn tại với query tối ưu hơn
      const existingTicket = interaction.guild.channels.cache.find(c =>
        c.parentId === conf.category_create &&
        c.topic && 
        c.topic.includes(`UID:${interaction.user.id}`) &&
        c.topic.startsWith('Ticket:')
      );
      
      if (existingTicket) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FFC107')
            .setTitle('⚠️ Ticket đã tồn tại')
            .setDescription(`Bạn đã có ticket đang mở tại <#${existingTicket.id}>!\nVui lòng hoàn thành ticket hiện tại trước khi tạo ticket mới.`)
            .setThumbnail(TICKET_ICON)
          ]
        });
        return true;
      }

      // Cải tiến: Transaction để đảm bảo tính nhất quán
      let ticketCount;
      try {
        const transaction = db.transaction(() => {
          const current = db.prepare('SELECT ticket_count FROM ticket_config WHERE guildId = ?').get(interaction.guild.id);
          const newCount = (current?.ticket_count || 0) + 1;
          
          db.prepare(`
            INSERT INTO ticket_config (guildId, ticket_count) 
            VALUES (?, ?) 
            ON CONFLICT(guildId) DO UPDATE SET ticket_count = ?
          `).run(interaction.guild.id, newCount, newCount);
          
          return newCount;
        });
        
        ticketCount = transaction();
        clearConfigCache(interaction.guild.id); // Xóa cache sau khi update
      } catch (error) {
        console.error('Database error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Lỗi hệ thống khi tạo ticket! Vui lòng thử lại sau.')]
        });
        return true;
      }

      const channelName = `ticket-${ticketCount.toString().padStart(4, '0')}`;
      const ticketTopic = `Ticket: ${ticketCount} | UID:${interaction.user.id} | Created: ${Date.now()}`;

      // Cải tiến: Xử lý role ping thông minh hơn
      let pingRole = conf.admin_role;
      if (!pingRole || !interaction.guild.roles.cache.has(pingRole)) {
        const adminRoles = interaction.guild.roles.cache
          .filter(r => r.id !== interaction.guild.id && r.permissions.has(PermissionFlagsBits.ManageChannels))
          .sort((a, b) => b.position - a.position);
        pingRole = adminRoles.first()?.id;
      }

      // Cải tiến: Tạo channel với error handling tốt hơn
      let ticketChannel;
      try {
        const permissionOverwrites = [
          { 
            id: interaction.guild.roles.everyone, 
            deny: [PermissionFlagsBits.ViewChannel] 
          },
          { 
            id: interaction.user.id, 
            allow: [
              PermissionFlagsBits.ViewChannel, 
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles
            ] 
          },
          { 
            id: interaction.client.user.id, 
            allow: [
              PermissionFlagsBits.ViewChannel, 
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages
            ] 
          }
        ];

        if (pingRole && interaction.guild.roles.cache.has(pingRole)) {
          permissionOverwrites.push({
            id: pingRole,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles
            ]
          });
        }

        ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: conf.category_create,
          topic: ticketTopic,
          permissionOverwrites: permissionOverwrites,
          rateLimitPerUser: 3, // 3 giây slowmode để tránh spam
        });
      } catch (error) {
        console.error('Channel creation error:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('Không thể tạo kênh ticket! Vui lòng kiểm tra quyền bot.')]
        });
        return true;
      }

      // Cải tiến: Gửi tin nhắn chào mừng với thông tin đầy đủ hơn
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket Hỗ Trợ')
        .setDescription([
          `**Mã Ticket:** \`#${ticketCount}\``,
          `**Người tạo:** <@${interaction.user.id}>`,
          `**Thời gian tạo:** <t:${Math.floor(Date.now() / 1000)}:F>`,
          '',
          '📝 **Hướng dẫn:**',
          '• Hãy mô tả chi tiết vấn đề bạn gặp phải',
          '• Đính kèm ảnh/video nếu cần thiết',
          '• Đợi admin phản hồi (thường trong vòng 24h)',
          '',
          '⚠️ **Lưu ý:** Không spam hoặc ping admin không cần thiết',
        ].join('\n'))
        .setColor('#2196f3')
        .setThumbnail(TICKET_ICON)
        .setFooter({ 
          text: `Ticket System • ID: ${ticketCount}`, 
          iconURL: TICKET_ICON 
        })
        .setTimestamp();

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('👮 Claim')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👮'),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Đóng Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId('ticket_priority')
          .setLabel('Ưu tiên cao')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡')
      );

      await ticketChannel.send({
        content: `<@${interaction.user.id}>${pingRole ? ` | <@&${pingRole}>` : ''}`,
        embeds: [welcomeEmbed],
        components: [actionRow],
      });

      // Cải tiến: Gửi DM với error handling
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#2196f3')
          .setTitle('🎫 Ticket đã được tạo')
          .setThumbnail(TICKET_ICON)
          .setDescription([
            `Bạn vừa tạo ticket thành công tại server **${interaction.guild.name}**.`,
            '',
            `**📋 Thông tin ticket:**`,
            `• **Mã:** \`#${ticketCount}\``,
            `• **Kênh:** <#${ticketChannel.id}>`,
            `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            '',
            '💡 **Mẹo:** Hãy mô tả vấn đề một cách chi tiết để được hỗ trợ nhanh nhất!',
          ].join('\n'))
          .setFooter({ text: 'Bạn sẽ nhận được thông báo khi có phản hồi' });

        await interaction.user.send({ embeds: [dmEmbed] });
      } catch (error) {
        // Không làm gì nếu không gửi được DM
      }

      // Cải tiến: Log với thông tin đầy đủ hơn
      if (conf.log_channel) {
        const logChannel = interaction.guild.channels.cache.get(conf.log_channel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('📩 Ticket Mới')
            .setDescription([
              `**Kênh:** <#${ticketChannel.id}>`,
              `**Mã:** \`#${ticketCount}\``,
              `**Người tạo:** <@${interaction.user.id}> (${interaction.user.tag})`,
              `**Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            ].join('\n'))
            .setColor('#4CAF50')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: 'Ticket Log', iconURL: TICKET_ICON })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          `Ticket đã được tạo thành công!\n\n**📍 Kênh:** <#${ticketChannel.id}>\n**🔢 Mã:** \`#${ticketCount}\``
        )]
      });
      return true;
    }

    // --- CLAIM TICKET ---
    if (interaction.isButton() && interaction.customId === 'ticket_claim') {
      // Kiểm tra cooldown
      const cooldown = checkCooldown(interaction.user.id, 'claim_ticket');
      if (cooldown > 0) {
        await interaction.reply({
          embeds: [createErrorEmbed(`⏳ Vui lòng đợi ${cooldown} giây!`)],
          ephemeral: true
        });
        return true;
      }

      const conf = getTicketConfig(db, interaction.guild.id);
      
      // Cải tiến: Kiểm tra quyền linh hoạt hơn
      const hasAdminRole = conf.admin_role && interaction.member.roles.cache.has(conf.admin_role);
      const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
      
      if (!hasAdminRole && !hasManageChannels) {
        await interaction.reply({
          embeds: [createErrorEmbed('Bạn không có quyền claim ticket này!')],
          ephemeral: true
        });
        return true;
      }

      // Cải tiến: Kiểm tra xem đã được claim chưa
      const currentPerms = interaction.channel.permissionOverwrites.cache;
      const alreadyClaimed = currentPerms.some(perm => 
        perm.type === 1 && // Member type
        perm.allow.has(PermissionFlagsBits.ManageChannels) &&
        perm.id !== interaction.client.user.id
      );

      if (alreadyClaimed) {
        const claimedBy = currentPerms.find(perm => 
          perm.type === 1 && 
          perm.allow.has(PermissionFlagsBits.ManageChannels) &&
          perm.id !== interaction.client.user.id
        );
        
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#FFC107')
            .setTitle('⚠️ Ticket đã được claim')
            .setDescription(`Ticket này đã được claim bởi <@${claimedBy.id}>`)
          ],
          ephemeral: true
        });
        return true;
      }

      // Cập nhật quyền cho người claim
      await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ManageChannels: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });

      const claimEmbed = new EmbedBuilder()
        .setColor('#43ea3a')
        .setTitle('👮 Ticket đã được claim')
        .setDescription(`Ticket này đã được claim bởi ${interaction.user}!\n\n⏰ Thời gian: <t:${Math.floor(Date.now() / 1000)}:R>`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({
        embeds: [claimEmbed],
        ephemeral: false
      });

      // Log claim
      const conf2 = getTicketConfig(db, interaction.guild.id);
      if (conf2.log_channel) {
        const logChannel = interaction.guild.channels.cache.get(conf2.log_channel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('👮 Ticket Claimed')
            .setDescription([
              `**Ticket:** <#${interaction.channel.id}>`,
              `**Người claim:** ${interaction.user} (${interaction.user.tag})`,
              `**Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            ].join('\n'))
            .setColor('#FFC107')
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
      return true;
    }

    // --- ƯU TIÊN CAO ---
    if (interaction.isButton() && interaction.customId === 'ticket_priority') {
      const uid = interaction.channel.topic?.match(/UID:(\d{17,})/)?.[1];
      
      if (interaction.user.id !== uid && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Chỉ người tạo ticket hoặc admin mới có thể đặt ưu tiên cao!')],
          ephemeral: true
        });
        return true;
      }

      // Kiểm tra xem đã đặt ưu tiên chưa
      if (interaction.channel.name.includes('🔥')) {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#FFC107')
            .setDescription('⚠️ Ticket này đã được đặt ưu tiên cao!')
          ],
          ephemeral: true
        });
        return true;
      }

      await interaction.channel.setName(`🔥-${interaction.channel.name}`);
      
      const priorityEmbed = new EmbedBuilder()
        .setColor('#FF5722')
        .setTitle('⚡ Ticket ưu tiên cao')
        .setDescription(`${interaction.user} đã đặt ticket này ở mức ưu tiên cao!\n\n🚨 **Admin sẽ được thông báo ngay lập tức.**`)
        .setTimestamp();

      await interaction.reply({
        embeds: [priorityEmbed]
      });

      // Thông báo admin
      const conf = getTicketConfig(db, interaction.guild.id);
      if (conf.admin_role) {
        const adminRole = interaction.guild.roles.cache.get(conf.admin_role);
        if (adminRole) {
          await interaction.followUp({
            content: `🚨 <@&${conf.admin_role}> - Ticket ưu tiên cao cần được xử lý!`,
            ephemeral: false
          });
        }
      }

      return true;
    }

    // --- YÊU CẦU ĐÓNG TICKET ---
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      const uid = interaction.channel.topic?.match(/UID:(\d{17,})/)?.[1];
      const ticketId = interaction.channel.topic?.match(/Ticket:\s*(\d+)/)?.[1] || 'unknown';

      if (interaction.user.id === uid) {
        // User tạo ticket yêu cầu đóng
        const embed = new EmbedBuilder()
          .setColor('#4AA4FF')
          .setAuthor({ name: 'Đóng Ticket', iconURL: TICKET_ICON })
          .setTitle('🔒 Yêu cầu đóng ticket')
          .setDescription([
            `Người dùng <@${interaction.user.id}> yêu cầu đóng ticket này.`,
            '',
            '👮 **Admin cần xác nhận để hoàn tất việc đóng ticket.**',
            '',
            '⏳ Ticket sẽ được tự động đóng sau 24h nếu không có phản hồi.',
          ].join('\n'))
          .setFooter({ text: 'Ticket System | Cần xác nhận từ admin', iconURL: TICKET_ICON })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_admin_confirm_close:${ticketId}`)
            .setLabel('✅ Admin xác nhận đóng')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('ticket_cancel_close')
            .setLabel('🚫 Hủy yêu cầu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🚫'),
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: false
        });

        // Tự động đóng sau 24h nếu không có phản hồi
        setTimeout(async () => {
          try {
            const channel = await interaction.guild.channels.fetch(interaction.channel.id).catch(() => null);
            if (channel && channel.name.includes(ticketId)) {
              await closeTicket(interaction, db, 'Tự động đóng sau 24h không có phản hồi từ admin');
            }
          } catch (error) {
            // Ignore errors
          }
        }, 24 * 60 * 60 * 1000); // 24 giờ

      } else if (interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        // Admin đóng trực tiếp
        const modal = new ModalBuilder()
          .setCustomId('ticketclose_reason')
          .setTitle('Đóng ticket')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Lý do đóng ticket')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Nhập lý do đóng ticket...')
                .setRequired(true)
                .setMaxLength(1000),
            ),
          );
        await interaction.showModal(modal);
      } else {
        await interaction.reply({
          embeds: [createErrorEmbed('Bạn không có quyền đóng ticket này!')],
          ephemeral: true
        });
      }
      return true;
    }

    // --- ADMIN XÁC NHẬN ĐÓNG TICKET ---
    if (interaction.isButton() && interaction.customId.startsWith('ticket_admin_confirm_close:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Chỉ admin mới có thể xác nhận đóng ticket!')],
          ephemeral: true
        });
        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId('ticketclose_reason')
        .setTitle('Xác nhận đóng ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Lý do đóng ticket')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Nhập lý do đóng ticket...')
              .setRequired(true)
              .setMaxLength(1000),
          ),
        );

      await interaction.showModal(modal);
      return true;
    }

    // --- HỦY YÊU CẦU ĐÓNG ---
    if (interaction.isButton() && interaction.customId === 'ticket_cancel_close') {
      const uid = interaction.channel.topic?.match(/UID:(\d{17,})/)?.[1];
      
      if (interaction.user.id !== uid && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Bạn không có quyền hủy yêu cầu này!')],
          ephemeral: true
        });
        return true;
      }

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#FFC107')
            .setTitle('🚫 Đã hủy yêu cầu')
            .setDescription('Yêu cầu đóng ticket đã bị hủy.')
            .setTimestamp()
        ],
        components: [],
      });
      return true;
    }

    // --- ĐÓNG TICKET (MODAL SUBMIT) ---
    if (interaction.isModalSubmit() && interaction.customId === 'ticketclose_reason') {
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.fields.getTextInputValue('reason');
      
      if (!reason || reason.trim().length === 0) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Vui lòng nhập lý do đóng ticket!')]
        });
        return true;
      }

      await closeTicket(interaction, db, reason.trim());
      await interaction.editReply({
        embeds: [createSuccessEmbed('Ticket đã được đóng thành công!')]
      });
      return true;
    }

    // --- XEM LỊCH SỬ TRÒ CHUYỆN ---
    if (interaction.isButton() && interaction.customId.startsWith('ticket_view_history')) {
      await interaction.deferReply({ ephemeral: true });

      const [, ticketId, guildId] = interaction.customId.split(':');
      if (!ticketId || !guildId) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Không thể xác định thông tin ticket!')]
        });
        return true;
      }

      // Kiểm tra quyền xem lịch sử
      let uid = interaction.user.id;
      if (interaction.channel?.topic) {
        const uidMatch = interaction.channel.topic.match(/UID:(\d{17,})/);
        if (uidMatch) uid = uidMatch[1];
      } else {
        try {
          const ticketInfo = db.prepare('SELECT userId FROM ticket_logs WHERE ticketId = ? AND guildId = ?').get(`ticket-${ticketId}`, guildId);
          if (ticketInfo?.userId) uid = ticketInfo.userId;
        } catch (error) {
          // Ignore database errors
        }
      }

      const isOwner = interaction.user.id === uid;
      const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !isAdmin) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Bạn không có quyền xem lịch sử ticket này!')]
        });
        return true;
      }

      // Tìm file log
      const logFilePath = path.join(__dirname, '..', 'ticketlog', `ticket-${ticketId}.md`);
      let logText;
      
      try {
        logText = await fs.readFile(logFilePath, 'utf-8');
      } catch (error) {
        // Thử tìm trong database
        try {
          const dbLog = db.prepare('SELECT logText FROM ticket_logs WHERE ticketId = ? AND guildId = ?').get(`ticket-${ticketId}`, guildId);
          logText = dbLog?.logText;
        } catch (dbError) {
          // Ignore database errors
        }
      }

      if (!logText) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Không tìm thấy lịch sử ticket này!')]
        });
        return true;
      }

      const logBuffer = Buffer.from(logText, 'utf-8');
      const fileSize = logBuffer.length;
      
      // Kiểm tra kích thước file (Discord limit: 8MB)
      if (fileSize > 8 * 1024 * 1024) {
        await interaction.editReply({
          embeds: [createErrorEmbed('File lịch sử quá lớn để gửi! Vui lòng liên hệ admin.')]
        });
        return true;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#2196f3')
            .setTitle('📜 Lịch sử ticket')
            .setDescription(`Lịch sử chi tiết của ticket #${ticketId}`)
            .setFooter({ text: `Kích thước: ${(fileSize / 1024).toFixed(2)} KB` })
        ],
        files: [{ 
          attachment: logBuffer, 
          name: `ticket-${ticketId}-history.md` 
        }],
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Ticket interaction error:', error);
    
    const errorEmbed = createErrorEmbed('Đã xảy ra lỗi hệ thống! Vui lòng thử lại sau.');
    
    try {
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

// --- HÀM ĐÓNG TICKET (CẢI TIẾN) ---
async function closeTicket(interaction, db, reason) {
  try {
    let ticketId = interaction.channel.topic?.match(/Ticket:\s*(\d+)/)?.[1];
    const uid = interaction.channel.topic?.match(/UID:(\d{17,})/)?.[1];
    const createdTime = interaction.channel.topic?.match(/Created:\s*(\d+)/)?.[1];

    if (!ticketId) {
      const conf = getTicketConfig(db, interaction.guild.id);
      ticketId = conf?.ticket_count?.toString() || 'unknown';
    }

    // Cải tiến: Lưu log với metadata đầy đủ
    const messages = await fetchAllMessages(interaction.channel);
    const logText = generateTicketLog(messages, {
      ticketId,
      userId: uid,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      createdAt: createdTime ? new Date(parseInt(createdTime)) : null,
      closedAt: new Date(),
      closedBy: interaction.user.id,
      reason: reason
    });

    // Lưu vào database và file
    await saveTicketLog(db, ticketId, interaction.guild.id, uid, logText);

    // Thông báo đóng ticket
    const closeEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🔒 Ticket đã đóng')
      .setDescription([
        `**Mã ticket:** \`#${ticketId}\``,
        `**Đóng bởi:** ${interaction.user}`,
        `**Lý do:** ${reason}`,
        `**Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
      ].join('\n'))
      .setThumbnail(TICKET_ICON)
      .setTimestamp();

    const historyButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
        .setLabel('📜 Xem lịch sử')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📜'),
      new ButtonBuilder()
        .setCustomId('ticket_closed')
        .setLabel('Ticket đã đóng')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
        .setEmoji('🔒'),
    );

    await interaction.channel.send({
      embeds: [closeEmbed],
      components: [historyButton],
    });

    // Gửi DM cho user
    if (uid) {
      try {
        const member = await interaction.guild.members.fetch(uid).catch(() => null);
        if (member) {
          const dmEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🔒 Ticket đã được đóng')
            .setThumbnail(TICKET_ICON)
            .setDescription([
              `🎫 Ticket của bạn tại **${interaction.guild.name}** đã được đóng.`,
              '',
              `**📋 Thông tin:**`,
              `• **Mã:** \`#${ticketId}\``,
              `• **Lý do:** ${reason}`,
              `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:R>`,
              '',
              '💡 Nếu vẫn cần hỗ trợ, hãy tạo ticket mới!',
            ].join('\n'))
            .setTimestamp();

          await member.send({
            embeds: [dmEmbed],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
                  .setLabel('📜 Xem lịch sử')
                  .setStyle(ButtonStyle.Primary),
              ),
            ],
          });
        }
      } catch (error) {
        // Ignore DM errors
      }
    }

    // Log vào channel log
    const conf = getTicketConfig(db, interaction.guild.id);
    if (conf.log_channel) {
      const logChannel = interaction.guild.channels.cache.get(conf.log_channel);
      if (logChannel) {
        const adminLogEmbed = new EmbedBuilder()
          .setTitle('📦 Ticket đã đóng')
          .setDescription([
            `**Kênh:** <#${interaction.channel.id}>`,
            `**Mã:** \`#${ticketId}\``,
            `**User:** <@${uid || 'unknown'}>`,
            `**Đóng bởi:** ${interaction.user} (${interaction.user.tag})`,
            `**Lý do:** ${reason}`,
            `**Số tin nhắn:** ${messages.length}`,
          ].join('\n'))
          .setColor('#E74C3C')
          .setFooter({ text: 'Ticket Log', iconURL: TICKET_ICON })
          .setTimestamp();

        await logChannel.send({
          embeds: [adminLogEmbed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
                .setLabel('📜 Xem lịch sử')
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        }).catch(() => {});
      }
    }

    // Di chuyển ticket sang danh mục đóng nếu có
    if (conf.category_close) {
      try {
        await interaction.channel.setParent(conf.category_close);
        
        const overwrites = [
          { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
        ];
        
        if (conf.admin_role && interaction.guild.roles.cache.has(conf.admin_role)) {
          overwrites.push({ 
            id: conf.admin_role, 
            allow: [PermissionFlagsBits.ViewChannel] 
          });
        }
        
        await interaction.channel.permissionOverwrites.set(overwrites);
        
        // Tự động xóa sau 24 giờ
        setTimeout(async () => {
          try {
            const channel = await interaction.guild.channels.fetch(interaction.channel.id).catch(() => null);
            if (channel) {
              await channel.delete();
              
              // Log việc xóa
              if (conf.log_channel) {
                const logCh = interaction.guild.channels.cache.get(conf.log_channel);
                if (logCh) {
                  await logCh.send({
                    embeds: [
                      new EmbedBuilder()
                        .setTitle('🗑️ Ticket đã xóa')
                        .setDescription(`Ticket \`#${ticketId}\` đã được tự động xóa sau 24 giờ.`)
                        .setColor('#95A5A6')
                        .setTimestamp()
                        .setFooter({ text: 'Auto Delete', iconURL: TICKET_ICON }),
                    ],
                  }).catch(() => {});
                }
              }
            }
          } catch (error) {
            console.error('Auto delete error:', error);
          }
        }, 24 * 60 * 60 * 1000); // 24 giờ
        
      } catch (error) {
        console.error('Move to close category error:', error);
      }
    }

    // Vô hiệu hóa các button trong ticket
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      for (const message of messages.values()) {
        if (message.author.id === interaction.client.user.id && message.components?.length > 0) {
          const hasTicketButtons = message.components.some(row => 
            row.components.some(component => 
              component.customId?.includes('ticket_') && 
              !component.customId.includes('ticket_view_history') &&
              !component.customId.includes('ticket_closed')
            )
          );
          
          if (hasTicketButtons) {
            await message.edit({
              components: [historyButton]
            }).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.error('Disable buttons error:', error);
    }

  } catch (error) {
    console.error('Close ticket error:', error);
    throw error;
  }
}

// --- HÀM TẠO LOG TICKET ---
function generateTicketLog(messages, metadata) {
  const header = [
    `# 🎫 Ticket Log #${metadata.ticketId}`,
    '',
    `**📋 Thông tin ticket:**`,
    `- **Mã ticket:** #${metadata.ticketId}`,
    `- **Server ID:** ${metadata.guildId}`,
    `- **Channel ID:** ${metadata.channelId}`,
    `- **User ID:** ${metadata.userId}`,
    `- **Thời gian tạo:** ${metadata.createdAt ? metadata.createdAt.toLocaleString('vi-VN') : 'Không xác định'}`,
    `- **Thời gian đóng:** ${metadata.closedAt.toLocaleString('vi-VN')}`,
    `- **Đóng bởi:** <@${metadata.closedBy}>`,
    `- **Lý do đóng:** ${metadata.reason}`,
    `- **Tổng số tin nhắn:** ${messages.length}`,
    '',
    '---',
    '',
    '## 💬 Lịch sử trò chuyện:',
    ''
  ].join('\n');

  const messageLog = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(message => {
      const time = new Date(message.createdTimestamp).toLocaleString('vi-VN');
      let icon = '💬';
      
      if (message.author.bot) icon = '🤖';
      if (message.system) icon = '⚙️';
      if (message.type === 7) icon = '👋'; // Welcome message
      
      let content = message.content || '*[Tin nhắn trống]*';
      
      // Xử lý attachments
      if (message.attachments && message.attachments.size > 0) {
        const attachments = [...message.attachments.values()]
          .map(att => `[📎 ${att.name}](${att.url})`)
          .join(', ');
        content += `\n*Đính kèm: ${attachments}*`;
      }
      
      // Xử lý embeds
      if (message.embeds && message.embeds.length > 0) {
        content += `\n*[📋 Embed: ${message.embeds.length} embed(s)]*`;
      }
      
      // Xử lý reactions
      if (message.reactions && message.reactions.cache.size > 0) {
        const reactions = [...message.reactions.cache.values()]
          .map(reaction => `${reaction.emoji} ${reaction.count}`)
          .join(' ');
        content += `\n*Reactions: ${reactions}*`;
      }
      
      return [
        `### ${icon} ${message.author.tag} - ${time}`,
        content,
        ''
      ].join('\n');
    })
    .join('\n');

  const footer = [
    '---',
    '',
    `*📊 Log được tạo tự động bởi Ticket System vào ${new Date().toLocaleString('vi-VN')}*`
  ].join('\n');

  return [header, messageLog, footer].join('\n');
}

// --- HÀM LƯU LOG ---
async function saveTicketLog(db, ticketId, guildId, userId, logText) {
  // Lưu vào database
  try {
    const hasUserIdColumn = db.prepare('PRAGMA table_info(ticket_logs)').all()
      .some(col => col.name === 'userId');
    
    if (hasUserIdColumn) {
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, userId, logText, createdAt) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(ticketId, guildId) DO UPDATE SET 
          userId = ?, logText = ?, updatedAt = ?
      `).run(
        `ticket-${ticketId}`, guildId, userId, logText, Date.now(),
        userId, logText, Date.now()
      );
    } else {
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, logText) 
        VALUES (?, ?, ?) 
        ON CONFLICT(ticketId, guildId) DO UPDATE SET logText = ?
      `).run(`ticket-${ticketId}`, guildId, logText, logText);
    }
  } catch (error) {
    console.error('Database save error:', error);
  }

  // Lưu vào file
  try {
    const logDir = path.join(__dirname, '..', 'ticketlog');
    await fs.mkdir(logDir, { recursive: true });
    const logFilePath = path.join(logDir, `ticket-${ticketId}.md`);
    await fs.writeFile(logFilePath, logText, 'utf-8');
  } catch (error) {
    console.error('File save error:', error);
  }
}

// --- HÀM LẤY TẤT CẢ TIN NHẮN (CẢI TIẾN) ---
async function fetchAllMessages(channel, limit = 10000) {
  let messages = [];
  let lastId;
  let fetchCount = 0;
  const maxFetches = Math.ceil(limit / 100);
  
  try {
    while (fetchCount < maxFetches) {
      const options = { limit: Math.min(100, limit - messages.length) };
      if (lastId) options.before = lastId;
      
      const fetched = await channel.messages.fetch(options);
      if (!fetched || fetched.size === 0) break;
      
      const fetchedArray = [...fetched.values()];
      messages = [...fetchedArray, ...messages];
      lastId = fetched.first()?.id;
      fetchCount++;
      
      if (fetched.size < 100 || messages.length >= limit) break;
      
      // Tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Fetch messages error:', error);
  }
  
  return messages.slice(0, limit);
}

// --- CLEANUP FUNCTIONS ---
function cleanupCaches() {
  const now = Date.now();
  
  // Cleanup config cache
  for (const [key, value] of configCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      configCache.delete(key);
    }
  }
  
  // Cleanup cooldowns
  for (const [key, timestamp] of ticketCooldowns.entries()) {
    if (now - timestamp > COOLDOWN_TIME) {
      ticketCooldowns.delete(key);
    }
  }
}

// Cleanup mỗi 5 phút
setInterval(cleanupCaches, 5 * 60 * 1000);

module.exports = { 
  handleTicketInteraction,
  cleanupCaches,
  getTicketConfig,
  clearConfigCache
};