const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');

const PANEL_ICON = 'https://cdn-icons-png.flaticon.com/512/595/595661.png';
const ADMIN_ICON = 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png';
const CATEGORY_ICON = 'https://cdn-icons-png.flaticon.com/512/2311/2311524.png';
const LOG_ICON = 'https://cdn-icons-png.flaticon.com/512/4230/4230499.png';

async function handleTicketUIInteraction(interaction, db) {
  // ==== TÙY CHỈNH GIAO DIỆN TICKET ====
  if (interaction.isButton() && interaction.customId === 'setup_ticket_ui') {
    const conf = db.prepare('SELECT * FROM ticket_config WHERE guildId = ?').get(interaction.guild.id) || {};
    const curTitle = conf.panel_title || '🎫 HỖ TRỢ KHÁCH HÀNG';
    const curDesc = conf.panel_desc || 'Nhấn **MỞ TICKET** để được hỗ trợ riêng tư!';
    const curBtn = conf.button_label || '🎫 MỞ TICKET';

    const modal = new ModalBuilder()
      .setCustomId('ticket_ui_custom')
      .setTitle('⚙️ Tùy chỉnh giao diện mở ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_title')
            .setLabel('Tiêu đề panel mở ticket')
            .setValue(curTitle)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('panel_desc')
            .setLabel('Mô tả panel')
            .setValue(curDesc)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('button_label')
            .setLabel('Tên nút mở ticket')
            .setValue(curBtn)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(40)
        )
      );
    
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_ui_custom') {
    const panelTitle = interaction.fields.getTextInputValue('panel_title').slice(0, 100);
    const panelDesc = interaction.fields.getTextInputValue('panel_desc').slice(0, 500);
    const buttonLabel = interaction.fields.getTextInputValue('button_label').slice(0, 40);

    db.prepare(
      `INSERT INTO ticket_config (guildId, panel_title, panel_desc, button_label)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guildId) DO UPDATE SET 
       panel_title = excluded.panel_title,
       panel_desc = excluded.panel_desc,
       button_label = excluded.button_label`
    ).run(interaction.guild.id, panelTitle, panelDesc, buttonLabel);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã lưu tùy chỉnh giao diện mở ticket!')
          .setDescription(`• **Tiêu đề:** ${panelTitle}\n• **Mô tả:** ${panelDesc}\n• **Tên nút:** ${buttonLabel}`)
          .setColor('#27ae60')
          .setThumbnail(PANEL_ICON)
      ],
      ephemeral: true
    });
    return true;
  }

  // ===== THIẾT LẬP DANH MỤC TẠO TICKET =====
  if (interaction.isButton() && interaction.customId === 'setup_ticket_create') {
    const select = new ChannelSelectMenuBuilder()
      .setCustomId('select_ticket_create_category')
      .setChannelTypes(ChannelType.GuildCategory)
      .setPlaceholder('🗂️ Chọn danh mục để tạo ticket')
      .setMaxValues(1)
      .setMinValues(1);
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗂️ Thiết lập danh mục tạo ticket')
          .setDescription('Vui lòng chọn danh mục dùng để chứa các ticket mới!')
          .setColor('#6C5CE7')
          .setThumbnail(CATEGORY_ICON)
      ],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return true;
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_ticket_create_category') {
    await interaction.deferUpdate();
    const catId = interaction.values[0];
    
    db.prepare(
      `INSERT INTO ticket_config (guildId, category_create)
       VALUES (?, ?)
       ON CONFLICT(guildId) DO UPDATE SET category_create = excluded.category_create`
    ).run(interaction.guild.id, catId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã lưu danh mục tạo ticket!')
          .setDescription(`<#${catId}> sẽ là nơi chứa các ticket mới.`)
          .setColor('#27ae60')
          .setThumbnail(CATEGORY_ICON)
      ],
      components: [],
    });
    return true;
  }

  // ===== THIẾT LẬP DANH MỤC LƯU TICKET ĐÃ ĐÓNG =====
  if (interaction.isButton() && interaction.customId === 'setup_ticket_close') {
    const select = new ChannelSelectMenuBuilder()
      .setCustomId('select_ticket_close_category')
      .setChannelTypes(ChannelType.GuildCategory)
      .setPlaceholder('📦 Chọn danh mục lưu ticket đã đóng')
      .setMaxValues(1)
      .setMinValues(1);
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📦 Thiết lập danh mục lưu ticket đã đóng')
          .setDescription('Chọn danh mục để lưu các ticket đã đóng.')
          .setColor('#fdcb6e')
          .setThumbnail(CATEGORY_ICON)
      ],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return true;
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_ticket_close_category') {
    await interaction.deferUpdate();
    const catId = interaction.values[0];
    
    db.prepare(
      `INSERT INTO ticket_config (guildId, category_close)
       VALUES (?, ?)
       ON CONFLICT(guildId) DO UPDATE SET category_close = excluded.category_close`
    ).run(interaction.guild.id, catId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã lưu danh mục lưu ticket đã đóng!')
          .setDescription(`<#${catId}> sẽ là nơi lưu các ticket đã đóng.`)
          .setColor('#27ae60')
          .setThumbnail(CATEGORY_ICON)
      ],
      components: [],
    });
    return true;
  }

  // ===== THIẾT LẬP KÊNH LOG =====
  if (interaction.isButton() && interaction.customId === 'setup_ticket_log') {
    const select = new ChannelSelectMenuBuilder()
      .setCustomId('select_ticket_log_channel')
      .setChannelTypes(ChannelType.GuildText)
      .setPlaceholder('📋 Chọn kênh ghi log ticket')
      .setMaxValues(1)
      .setMinValues(1);
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📋 Thiết lập kênh ghi log')
          .setDescription('Chọn kênh để nhận log tất cả hoạt động ticket.')
          .setColor('#0984e3')
          .setThumbnail(LOG_ICON)
      ],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return true;
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_ticket_log_channel') {
    await interaction.deferUpdate();
    const channelId = interaction.values[0];
    
    db.prepare(
      `INSERT INTO ticket_config (guildId, log_channel)
       VALUES (?, ?)
       ON CONFLICT(guildId) DO UPDATE SET log_channel = excluded.log_channel`
    ).run(interaction.guild.id, channelId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã lưu kênh ghi log ticket!')
          .setDescription(`<#${channelId}> sẽ nhận log các hoạt động ticket.`)
          .setColor('#27ae60')
          .setThumbnail(LOG_ICON)
      ],
      components: [],
    });
    return true;
  }

  // ===== THIẾT LẬP VAI TRÒ QUẢN TRỊ =====
  if (interaction.isButton() && interaction.customId === 'setup_ticket_role') {
    const select = new RoleSelectMenuBuilder()
      .setCustomId('select_ticket_admin_role')
      .setPlaceholder('👮‍♂️ Chọn vai trò quản trị ticket')
      .setMaxValues(1)
      .setMinValues(1);
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('👮‍♂️ Thiết lập vai trò quản trị')
          .setDescription('Chọn vai trò để quản lý và có thể xem tất cả ticket.')
          .setColor('#00b894')
          .setThumbnail(ADMIN_ICON)
      ],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return true;
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_ticket_admin_role') {
    await interaction.deferUpdate();
    const roleId = interaction.values[0];
    
    db.prepare(
      `INSERT INTO ticket_config (guildId, admin_role)
       VALUES (?, ?)
       ON CONFLICT(guildId) DO UPDATE SET admin_role = excluded.admin_role`
    ).run(interaction.guild.id, roleId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã lưu vai trò quản trị!')
          .setDescription(`<@&${roleId}> sẽ là vai trò quản lý ticket.`)
          .setColor('#27ae60')
          .setThumbnail(ADMIN_ICON)
      ],
      components: [],
    });
    return true;
  }

  return false;
}

module.exports = { handleTicketUIInteraction };