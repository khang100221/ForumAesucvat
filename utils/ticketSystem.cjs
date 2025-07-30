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

// Constants
const TICKET_ICON = 'https://cdn-icons-png.flaticon.com/512/4332/4332637.png';
const COLORS = {
  SUCCESS: '#43ea3a',
  ERROR: '#E74C3C',
  WARNING: '#FFC107',
  INFO: '#2196f3',
  PRIMARY: '#4AA4FF',
  CLOSE: '#2ecc71'
};

// Anti-spam protection
const ticketFastCloseFlag = new Set();
const ticketCreationCooldown = new Map();
const COOLDOWN_TIME = 30000; // 30 seconds

// Cache for frequently accessed data
const configCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

/**
 * Enhanced ticket interaction handler with improved error handling and performance
 */
async function handleTicketInteraction(interaction, db) {
  try {
    // Route interactions to specific handlers
    const handlers = {
      'ticket_create': handleTicketCreate,
      'ticket_claim': handleTicketClaim,
      'ticket_close': handleTicketClose,
      'ticket_close_now': handleTicketCloseNow,
      'ticket_cancel_close': handleTicketCancelClose,
      'ticketclose_reason': handleTicketCloseModal,
    };

    // Handle button interactions
    if (interaction.isButton()) {
      const customId = interaction.customId.split(':')[0];
      const handler = handlers[customId];
      
      if (handler) {
        return await handler(interaction, db);
      }

      // Handle dynamic button IDs
      if (interaction.customId.startsWith('ticket_admin_confirm_close:')) {
        return await handleAdminConfirmClose(interaction, db);
      }
      
      if (interaction.customId.startsWith('ticket_view_history')) {
        return await handleViewHistory(interaction, db);
      }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit() && handlers[interaction.customId]) {
      return await handlers[interaction.customId](interaction, db);
    }

    return false;
  } catch (error) {
    console.error('Error in handleTicketInteraction:', error);
    return await handleInteractionError(interaction, error);
  }
}

/**
 * Handle ticket creation with enhanced validation and rate limiting
 */
async function handleTicketCreate(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  // Rate limiting check
  const userId = interaction.user.id;
  const now = Date.now();
  const lastCreation = ticketCreationCooldown.get(userId);
  
  if (lastCreation && (now - lastCreation) < COOLDOWN_TIME) {
    const remaining = Math.ceil((COOLDOWN_TIME - (now - lastCreation)) / 1000);
    return await interaction.editReply({
      embeds: [createErrorEmbed(`⏳ Bạn cần đợi ${remaining} giây trước khi tạo ticket mới!`)]
    });
  }

  const config = await getTicketConfig(db, interaction.guild.id);
  
  // Validate configuration
  const validationResult = await validateTicketConfig(config, interaction.guild);
  if (!validationResult.valid) {
    return await interaction.editReply({
      embeds: [createErrorEmbed(validationResult.message)]
    });
  }

  // Check for existing ticket
  const existingTicket = await findExistingTicket(interaction.guild, config.category_create, userId);
  if (existingTicket) {
    return await interaction.editReply({
      embeds: [createWarningEmbed(`⚠️ Bạn đã có ticket đang mở tại <#${existingTicket.id}>!`)]
    });
  }

  // Create ticket
  try {
    const ticketData = await createTicketChannel(interaction, db, config);
    ticketCreationCooldown.set(userId, now);
    
    // Clean up cooldown after timeout
    setTimeout(() => ticketCreationCooldown.delete(userId), COOLDOWN_TIME);
    
    return await interaction.editReply({
      embeds: [createSuccessEmbed(`✅ Ticket đã được tạo: <#${ticketData.channel.id}> | Mã: \`${ticketData.ticketId}\``)]
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return await interaction.editReply({
      embeds: [createErrorEmbed('❌ Lỗi khi tạo ticket! Vui lòng thử lại sau.')]
    });
  }
}

/**
 * Handle ticket claiming with permission validation
 */
async function handleTicketClaim(interaction, db) {
  if (!hasManageChannelsPermission(interaction.member)) {
    return await interaction.reply({
      embeds: [createErrorEmbed('❌ Bạn không đủ quyền claim!')],
      ephemeral: true
    });
  }

  try {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ManageChannels: true,
    });

    await interaction.reply({
      embeds: [createSuccessEmbed(`👮 Ticket này đã được claim bởi ${interaction.user}!`)],
      ephemeral: false
    });

    // Log the claim
    await logTicketAction(db, interaction, 'CLAIM');
    return true;
  } catch (error) {
    console.error('Error claiming ticket:', error);
    return await interaction.reply({
      embeds: [createErrorEmbed('❌ Lỗi khi claim ticket!')],
      ephemeral: true
    });
  }
}

/**
 * Handle ticket close request with user/admin logic
 */
async function handleTicketClose(interaction, db) {
  const ticketInfo = parseTicketTopic(interaction.channel.topic);
  const isTicketOwner = interaction.user.id === ticketInfo.uid;
  const isAdmin = hasManageChannelsPermission(interaction.member);

  if (isTicketOwner) {
    return await showCloseConfirmation(interaction, ticketInfo.ticketId);
  } else if (isAdmin) {
    return await showCloseModal(interaction);
  } else {
    return await interaction.reply({
      embeds: [createErrorEmbed('❌ Bạn không có quyền đóng ticket này!')],
      ephemeral: true
    });
  }
}

/**
 * Handle quick close with admin bypass
 */
async function handleTicketCloseNow(interaction, db) {
  const flagKey = `ticketclose:${interaction.channel.id}`;
  
  if (ticketFastCloseFlag.has(flagKey)) {
    return await interaction.reply({
      embeds: [createInfoEmbed('⏳ Ticket đang được đóng, vui lòng đợi giây lát...')],
      ephemeral: true
    });
  }

  const isAdmin = hasManageChannelsPermission(interaction.member);
  const ticketInfo = parseTicketTopic(interaction.channel.topic);

  if (isAdmin) {
    ticketFastCloseFlag.add(flagKey);
    setTimeout(() => ticketFastCloseFlag.delete(flagKey), 5000);
    
    await interaction.deferReply({ ephemeral: true });
    await closeTicket(interaction, db, 'Đóng nhanh (không ghi lý do)');
    
    return await interaction.editReply({
      embeds: [createSuccessEmbed('✅ Ticket đã được đóng thành công!')]
    });
  } else {
    return await showCloseConfirmation(interaction, ticketInfo.ticketId);
  }
}

/**
 * Handle admin confirmation for closing ticket
 */
async function handleAdminConfirmClose(interaction, db) {
  if (!hasManageChannelsPermission(interaction.member)) {
    return await interaction.reply({
      embeds: [createErrorEmbed('❌ Bạn không phải admin!')],
      ephemeral: true
    });
  }

  return await showCloseModal(interaction);
}

/**
 * Handle cancel close request
 */
async function handleTicketCancelClose(interaction, db) {
  const ticketInfo = parseTicketTopic(interaction.channel.topic);
  const canCancel = interaction.user.id === ticketInfo.uid || hasManageChannelsPermission(interaction.member);

  if (!canCancel) {
    return await interaction.reply({
      embeds: [createErrorEmbed('❌ Bạn không có quyền hủy yêu cầu này!')],
      ephemeral: true
    });
  }

  return await interaction.update({
    embeds: [createWarningEmbed('🚫 Yêu cầu đóng ticket đã bị hủy.')],
    components: [],
  });
}

/**
 * Handle ticket close modal submission
 */
async function handleTicketCloseModal(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const reason = interaction.fields.getTextInputValue('reason');
    await closeTicket(interaction, db, reason);
    
    return await interaction.editReply({
      embeds: [createSuccessEmbed('✅ Ticket đã được đóng thành công!')]
    });
  } catch (error) {
    console.error('Error closing ticket:', error);
    return await interaction.editReply({
      embeds: [createErrorEmbed('❌ Lỗi khi đóng ticket!')]
    });
  }
}

/**
 * Handle viewing ticket history
 */
async function handleViewHistory(interaction, db) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const [, ticketId, guildId] = interaction.customId.split(':');
    
    if (!ticketId || !guildId) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('❌ Không thể xác định ticket hoặc server!')]
      });
    }

    // Permission check
    const hasPermission = await checkHistoryPermission(interaction, db, ticketId, guildId);
    if (!hasPermission) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('❌ Bạn không có quyền xem lịch sử ticket này!')]
      });
    }

    // Get history file
    const historyFile = await getTicketHistory(ticketId);
    if (!historyFile) {
      return await interaction.editReply({
        embeds: [createErrorEmbed('❌ Không tìm thấy lịch sử ticket này!')]
      });
    }

    return await interaction.editReply({
      files: [{ attachment: historyFile, name: `ticket-${ticketId}.md` }],
    });
  } catch (error) {
    console.error('Error viewing history:', error);
    return await interaction.editReply({
      embeds: [createErrorEmbed('❌ Lỗi khi tải lịch sử ticket!')]
    });
  }
}

/**
 * Enhanced ticket closing function with comprehensive logging
 */
async function closeTicket(interaction, db, reason) {
  const ticketInfo = parseTicketTopic(interaction.channel.topic);
  let { ticketId, uid } = ticketInfo;

  // Fallback for ticket ID
  if (!ticketId) {
    const config = await getTicketConfig(db, interaction.guild.id);
    ticketId = config?.ticket_count?.toString() || 'unknown';
  }

  try {
    // Fetch and save message history
    const messages = await fetchAllMessages(interaction.channel);
    const logText = await formatMessageHistory(messages);
    
    // Save to database and file system
    await Promise.all([
      saveTicketLog(db, ticketId, interaction.guild.id, uid, logText),
      saveTicketLogFile(ticketId, logText)
    ]);

    // Send close notification to channel
    await sendCloseNotification(interaction, ticketId, reason);

    // Send notifications to user and log channel
    await Promise.all([
      sendUserCloseNotification(interaction, ticketId, uid, reason),
      logTicketClose(db, interaction, ticketId, uid, reason)
    ]);

    // Move to closed category and schedule deletion
    await moveToClosedCategory(interaction, db);
    
    // Disable buttons in previous messages
    await disableTicketButtons(interaction, ticketId);

  } catch (error) {
    console.error('Error in closeTicket:', error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Utility Functions
 */

async function getTicketConfig(db, guildId) {
  const cacheKey = `config:${guildId}`;
  const cached = configCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const config = db.prepare('SELECT * FROM ticket_config WHERE guildId = ?').get(guildId) || {};
  
  configCache.set(cacheKey, {
    data: config,
    timestamp: Date.now()
  });
  
  return config;
}

async function validateTicketConfig(config, guild) {
  if (!config.category_create) {
    return {
      valid: false,
      message: '❌ Ticket chưa được setup danh mục! Vui lòng liên hệ admin.'
    };
  }

  const category = guild.channels.cache.get(config.category_create);
  if (!category) {
    return {
      valid: false,
      message: '❌ Danh mục ticket không tồn tại! Vui lòng liên hệ admin.'
    };
  }

  const botPermissions = guild.members.me.permissionsIn(category);
  const requiredPermissions = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages
  ];

  if (!botPermissions.has(requiredPermissions)) {
    return {
      valid: false,
      message: '❌ Bot thiếu quyền tạo kênh! Vui lòng kiểm tra quyền của bot.'
    };
  }

  return { valid: true };
}

async function findExistingTicket(guild, categoryId, userId) {
  return guild.channels.cache.find(channel =>
    channel.parentId === categoryId &&
    channel.topic &&
    channel.topic.startsWith('Ticket:') &&
    channel.topic.includes(`UID:${userId}`)
  );
}

async function createTicketChannel(interaction, db, config) {
  // Increment ticket count
  let ticketCount = config.ticket_count || 0;
  ticketCount++;
  
  // Update database
  await updateTicketCount(db, interaction.guild.id, ticketCount);
  
  // Create channel
  const channelName = `ticket-${ticketCount.toString().padStart(3, '0')}`;
  const ticketTopic = `Ticket: ${ticketCount} | UID:${interaction.user.id}`;
  
  const pingRole = config.admin_role || await getHighestRole(interaction.guild);
  
  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.category_create,
    topic: ticketTopic,
    permissionOverwrites: createTicketPermissions(interaction, pingRole),
  });

  // Send initial message
  await sendInitialTicketMessage(channel, interaction.user, ticketCount, pingRole);
  
  // Send user notification
  await sendUserTicketNotification(interaction.user, interaction.guild, channel, ticketCount);
  
  // Log creation
  await logTicketCreation(db, interaction, channel, ticketCount);
  
  return { channel, ticketId: ticketCount };
}

function createTicketPermissions(interaction, pingRole) {
  const permissions = [
    { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  ];
  
  if (pingRole) {
    permissions.push({ id: pingRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }
  
  return permissions.filter(p => p.id);
}

async function sendInitialTicketMessage(channel, user, ticketCount, pingRole) {
  const content = `<@${user.id}>${pingRole ? ` | <@&${pingRole}>` : ''}`;
  
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Hỗ Trợ')
    .setDescription([
      `**Mã Ticket:** \`${ticketCount}\``,
      `**Người tạo:** <@${user.id}>`,
      'Hãy mô tả vấn đề bạn gặp phải bên dưới.',
      '⏳ Đợi admin phản hồi nhé!',
    ].join('\n'))
    .setColor(COLORS.INFO)
    .setThumbnail(TICKET_ICON)
    .setFooter({ text: 'Ticket System', iconURL: TICKET_ICON })
    .setTimestamp();

  const components = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('👮 Claim')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('🔒 Đóng Ticket')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_close_now')
      .setLabel('❌ Đóng Nhanh')
      .setStyle(ButtonStyle.Danger),
  );

  return await channel.send({
    content,
    embeds: [embed],
    components: [components],
  });
}

function parseTicketTopic(topic) {
  if (!topic) return { ticketId: null, uid: null };
  
  const ticketMatch = topic.match(/Ticket:\s*(\d+)/);
  const uidMatch = topic.match(/UID:(\d{17,})/);
  
  return {
    ticketId: ticketMatch?.[1] || null,
    uid: uidMatch?.[1] || null
  };
}

function hasManageChannelsPermission(member) {
  return member?.permissions.has(PermissionFlagsBits.ManageChannels);
}

async function showCloseConfirmation(interaction, ticketId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({ name: 'Đóng Ticket', iconURL: TICKET_ICON })
    .setTitle('🔒 Đề nghị đóng ticket')
    .setDescription([
      `Người dùng <@${interaction.user.id}> muốn đóng ticket này.`,
      'Admin cần xác nhận để hoàn tất việc đóng ticket.',
      '',
      '⏳ **Lưu ý: Yêu cầu đóng cần admin xác nhận!**',
    ].join('\n'))
    .setFooter({ text: 'Ticket System | Đóng ticket cần xác nhận bởi admin', iconURL: TICKET_ICON })
    .setTimestamp();

  const components = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_admin_confirm_close:${ticketId}`)
      .setLabel('✅ Admin xác nhận đóng')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_cancel_close')
      .setLabel('🚫 Hủy yêu cầu')
      .setStyle(ButtonStyle.Secondary),
  );

  return await interaction.reply({
    embeds: [embed],
    components: [components],
    ephemeral: false
  });
}

async function showCloseModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticketclose_reason')
    .setTitle('Đóng ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Lý do đóng ticket')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );
    
  return await interaction.showModal(modal);
}

// Enhanced message fetching with error handling
async function fetchAllMessages(channel) {
  const messages = [];
  let lastId;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const fetched = await channel.messages.fetch({ 
        limit: 100, 
        before: lastId 
      });
      
      if (!fetched || fetched.size === 0) break;
      
      messages.unshift(...fetched.values());
      lastId = fetched.last()?.id;
      
      if (fetched.size < 100) break;
      
      // Rate limiting protection
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching messages (attempt ${attempts + 1}):`, error);
      attempts++;
      
      if (attempts >= maxAttempts) {
        console.error('Max attempts reached for fetching messages');
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  return messages;
}

async function formatMessageHistory(messages) {
  return messages
    .map(message => {
      const time = new Date(message.createdTimestamp).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh'
      });
      
      let msgIcon = '💬';
      if (message.author.bot) msgIcon = '🤖';
      if (message.system) msgIcon = '⚙️';
      
      let content = message.content || '';
      
      // Handle attachments
      if (message.attachments?.size > 0) {
        const attachments = [...message.attachments.values()]
          .map(att => `[${att.name}](${att.url})`)
          .join(', ');
        content += ` [Đính kèm: ${attachments}]`;
      }
      
      // Handle embeds
      if (message.embeds?.length > 0) {
        content += ` [${message.embeds.length} embed(s)]`;
      }
      
      return `**[${time}]** ${msgIcon} **${message.author.tag}**: ${content}`;
    })
    .join('\n\n');
}

// Helper functions for embed creation
function createSuccessEmbed(description) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setDescription(description);
}

function createErrorEmbed(description) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setDescription(description)
    .setThumbnail(TICKET_ICON);
}

function createWarningEmbed(description) {
  return new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setDescription(description);
}

function createInfoEmbed(description) {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setDescription(description);
}

// Additional helper functions for database operations and logging
async function updateTicketCount(db, guildId, count) {
  try {
    db.prepare(`
      INSERT INTO ticket_config (guildId, ticket_count) 
      VALUES (?, ?) 
      ON CONFLICT(guildId) 
      DO UPDATE SET ticket_count = ?
    `).run(guildId, count, count);
    
    // Clear cache
    configCache.delete(`config:${guildId}`);
  } catch (error) {
    console.error('Error updating ticket count:', error);
    throw error;
  }
}

async function getHighestRole(guild) {
  const roles = guild.roles.cache
    .filter(role => role.id !== guild.id)
    .sort((a, b) => b.position - a.position);
  return roles.first()?.id;
}

async function saveTicketLog(db, ticketId, guildId, userId, logText) {
  try {
    const hasUserIdColumn = db.prepare('PRAGMA table_info(ticket_logs)')
      .all()
      .some(col => col.name === 'userId');
    
    if (hasUserIdColumn) {
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, userId, logText) 
        VALUES (?, ?, ?, ?) 
        ON CONFLICT(ticketId, guildId) 
        DO UPDATE SET userId = ?, logText = ?
      `).run(`ticket-${ticketId}`, guildId, userId, logText, userId, logText);
    } else {
      db.prepare(`
        INSERT INTO ticket_logs (ticketId, guildId, logText) 
        VALUES (?, ?, ?) 
        ON CONFLICT(ticketId, guildId) 
        DO UPDATE SET logText = ?
      `).run(`ticket-${ticketId}`, guildId, logText, logText);
    }
  } catch (error) {
    console.error('Error saving ticket log to database:', error);
  }
}

async function saveTicketLogFile(ticketId, logText) {
  try {
    const logDir = path.join(__dirname, '..', 'ticketlog');
    await fs.mkdir(logDir, { recursive: true });
    
    const logFilePath = path.join(logDir, `ticket-${ticketId}.md`);
    await fs.writeFile(logFilePath, logText || '[Không có tin nhắn]', 'utf-8');
  } catch (error) {
    console.error('Error saving ticket log file:', error);
  }
}

async function sendCloseNotification(interaction, ticketId, reason) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.CLOSE)
    .setTitle('🔒 Ticket đã đóng')
    .setDescription(`Ticket này đã được đóng bởi <@${interaction.user.id}>.\nLý do: **${reason}**`)
    .setThumbnail(TICKET_ICON)
    .setTimestamp();

  const components = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
      .setLabel('📜 Xem lại lịch sử trò chuyện')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_closed')
      .setLabel('🔒 Ticket đã đóng')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  return await interaction.channel.send({
    embeds: [embed],
    components: [components],
  });
}

async function handleInteractionError(interaction, error) {
  console.error('Interaction error:', error);
  
  const errorEmbed = createErrorEmbed('❌ Lỗi hệ thống khi xử lý ticket! Vui lòng thử lại.');
  
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
    console.error('Error sending error response:', replyError);
  }
  
  return true;
}

// Placeholder functions for additional features
async function sendUserTicketNotification(user, guild, channel, ticketCount) {
  try {
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🎫 Ticket Created')
      .setThumbnail(TICKET_ICON)
      .setDescription([
        `Bạn vừa mở ticket trên server **${guild.name}**.`,
        `**Mã Ticket:** \`${ticketCount}\``,
        `Truy cập: <#${channel.id}>`,
        'Hãy mô tả vấn đề để admin hỗ trợ nhé!',
      ].join('\n'));

    await user.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending user notification:', error);
  }
}

async function logTicketCreation(db, interaction, channel, ticketCount) {
  const config = await getTicketConfig(db, interaction.guild.id);
  
  if (config.log_channel) {
    try {
      const logChannel = interaction.guild.channels.cache.get(config.log_channel);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('📩 Ticket Mới')
          .setDescription(`Channel: <#${channel.id}> | Mã: \`${ticketCount}\` | User: <@${interaction.user.id}>`)
          .setColor(COLORS.SUCCESS)
          .setTimestamp()
          .setFooter({ text: 'Ticket Log', iconURL: TICKET_ICON });

        await logChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error logging ticket creation:', error);
    }
  }
}

async function logTicketAction(db, interaction, action) {
  const config = await getTicketConfig(db, interaction.guild.id);
  
  if (config.log_channel) {
    try {
      const logChannel = interaction.guild.channels.cache.get(config.log_channel);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle(`🔄 Ticket ${action}`)
          .setDescription(`Ticket <#${interaction.channel.id}> đã được ${action.toLowerCase()} bởi ${interaction.user.tag}`)
          .setColor(COLORS.WARNING)
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error logging ticket action:', error);
    }
  }
}

async function sendUserCloseNotification(interaction, ticketId, uid, reason) {
  if (!uid) return;
  
  try {
    const member = await interaction.guild.members.fetch(uid).catch(() => null);
    if (!member) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('🔒 Ticket Đã Đóng')
      .setThumbnail(TICKET_ICON)
      .setDescription([
        `🎫 Ticket của bạn tại **${interaction.guild.name}** đã được **đóng**.`,
        `**Mã Ticket:** \`${ticketId}\``,
        `**Lý do:** ${reason}`,
        `Nếu còn vấn đề, hãy tạo ticket mới nhé!`,
      ].join('\n'))
      .setTimestamp();

    const components = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
        .setLabel('📜 Xem lại lịch sử trò chuyện')
        .setStyle(ButtonStyle.Primary),
    );

    await member.send({
      embeds: [embed],
      components: [components],
    });
  } catch (error) {
    console.error('Error sending user close notification:', error);
  }
}

async function logTicketClose(db, interaction, ticketId, uid, reason) {
  const config = await getTicketConfig(db, interaction.guild.id);
  
  if (config.log_channel) {
    try {
      const logChannel = interaction.guild.channels.cache.get(config.log_channel);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('📦 Ticket Đã Đóng')
          .setDescription([
            `Channel: <#${interaction.channel.id}>`,
            `**Mã:** \`${ticketId}\``,
            `**User:** <@${uid || 'unknown'}>`,
            `**Người đóng:** ${interaction.user}`,
            `**Lý do:** ${reason}`,
          ].join('\n'))
          .setColor(COLORS.ERROR)
          .setFooter({ text: 'Ticket Log', iconURL: TICKET_ICON })
          .setTimestamp();

        const components = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
            .setLabel('📜 Xem lại lịch sử trò chuyện')
            .setStyle(ButtonStyle.Primary),
        );

        await logChannel.send({
          embeds: [embed],
          components: [components],
        });
      }
    } catch (error) {
      console.error('Error logging ticket close:', error);
    }
  }
}

async function moveToClosedCategory(interaction, db) {
  const config = await getTicketConfig(db, interaction.guild.id);
  
  if (config.category_close) {
    try {
      await interaction.channel.setParent(config.category_close);
      
      const overwrites = [
        { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel] },
      ];
      
      if (config.admin_role) {
        overwrites.push({ id: config.admin_role, allow: [PermissionFlagsBits.ViewChannel] });
      }
      
      await interaction.channel.permissionOverwrites.set(overwrites);
      
      // Schedule deletion after 6 hours
      setTimeout(async () => {
        try {
          const channel = await interaction.guild.channels.fetch(interaction.channel.id).catch(() => null);
          if (channel) {
            await channel.delete();
            
            // Log deletion
            if (config.log_channel) {
              const logChannel = interaction.guild.channels.cache.get(config.log_channel);
              if (logChannel) {
                const embed = new EmbedBuilder()
                  .setTitle('🗑️ Ticket Đã Xóa')
                  .setDescription(`Ticket đã được tự động xóa sau 6 giờ.`)
                  .setColor(COLORS.ERROR)
                  .setTimestamp()
                  .setFooter({ text: 'Ticket Log', iconURL: TICKET_ICON });

                await logChannel.send({ embeds: [embed] });
              }
            }
          }
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, 6 * 60 * 60 * 1000); // 6 hours
      
    } catch (error) {
      console.error('Error moving to closed category:', error);
    }
  }
}

async function disableTicketButtons(interaction, ticketId) {
  try {
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    
    for (const message of messages.values()) {
      if (message.author.id === interaction.client.user.id && message.embeds?.length) {
        const embed = message.embeds[0];
        
        if (embed.title === '🎫 Ticket Hỗ Trợ') {
          await message.edit({
            embeds: [embed],
            components: [],
          });
        } else if (embed.title !== '🔒 Ticket đã đóng' && message.components?.length) {
          const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_view_history:${ticketId}:${interaction.guild.id}`)
              .setLabel('📜 Xem lại lịch sử trò chuyện')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('ticket_closed')
              .setLabel('🔒 Ticket đã đóng')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          );
          
          await message.edit({ components: [components] });
        }
      }
    }
  } catch (error) {
    console.error('Error disabling ticket buttons:', error);
  }
}

async function checkHistoryPermission(interaction, db, ticketId, guildId) {
  // Admin can always view
  if (hasManageChannelsPermission(interaction.member)) {
    return true;
  }
  
  let uid = interaction.user.id;
  
  // Try to get UID from current channel topic
  if (interaction.channel?.topic) {
    const uidMatch = interaction.channel.topic.match(/UID:(\d{17,})/);
    if (uidMatch) uid = uidMatch[1];
  } else {
    // Try to get from database
    try {
      const ticketInfo = db.prepare('SELECT userId FROM ticket_logs WHERE ticketId = ? AND guildId = ?')
        .get(`ticket-${ticketId}`, guildId);
      if (ticketInfo?.userId) uid = ticketInfo.userId;
    } catch (error) {
      console.error('Error checking history permission:', error);
    }
  }
  
  return interaction.user.id === uid;
}

async function getTicketHistory(ticketId) {
  try {
    const logFilePath = path.join(__dirname, '..', 'ticketlog', `ticket-${ticketId}.md`);
    const logText = await fs.readFile(logFilePath, 'utf-8');
    return Buffer.from(logText || '[Không có tin nhắn]', 'utf-8');
  } catch (error) {
    console.error('Error getting ticket history:', error);
    return null;
  }
}

module.exports = { handleTicketInteraction };