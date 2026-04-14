const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder
} = require("discord.js");

const express = require("express");

// keep alive
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// config
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const STAFF_ROLE_ID = "1478564123259310090";
const CATEGORY_ID = "1488457065377824900";
const LOG_CHANNEL_ID = "1488466548828930118";

const cooldown = new Set();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// register command
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Create ticket panel")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

client.once("ready", () => {
  console.log("Ready: " + client.user.tag);
});

client.on("interactionCreate", async (interaction) => {

  // ===== PANEL COMMAND =====
  if (interaction.isChatInputCommand()) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: "No permission", ephemeral: true });
    }

    const select = new ChannelSelectMenuBuilder()
      .setCustomId("select_channel")
      .setPlaceholder("Select panel channel")
      .addChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      content: "Choose where to send the panel",
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  // ===== CHANNEL SELECT =====
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId !== "select_channel") return;

    const channelId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`panel_${channelId}`)
      .setTitle("Panel Setup");

    const title = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Panel Title")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const desc = new TextInputBuilder()
      .setCustomId("desc")
      .setLabel("Panel Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(desc)
    );

    return interaction.showModal(modal);
  }

  // ===== PANEL CREATE =====
  if (interaction.isModalSubmit() && interaction.customId.startsWith("panel_")) {

    const channelId = interaction.customId.split("_")[1];
    const channel = await client.channels.fetch(channelId);

    const title = interaction.fields.getTextInputValue("title");
    const desc = interaction.fields.getTextInputValue("desc");

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(title)
      .setDescription(desc);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_support").setLabel("Support").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_buy").setLabel("Buy").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_other").setLabel("Other").setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: "Panel created!", ephemeral: true });
  }

  // ===== CREATE TICKET =====
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {

    if (cooldown.has(interaction.user.id)) {
      return interaction.reply({ content: "Wait a few seconds.", ephemeral: true });
    }

    cooldown.add(interaction.user.id);
    setTimeout(() => cooldown.delete(interaction.user.id), 5000);

    const type = interaction.customId.split("_")[1];

    const ticketChannel = await interaction.guild.channels.create({
      name: `${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    await ticketChannel.setPosition(9999);

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("Ticket Created")
      .setDescription(`Type: **${type}**\nUser: <@${interaction.user.id}>`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("rename").setLabel("Rename").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [embed],
      components: [row]
    });

    return interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (interaction.isButton() && interaction.customId === "claim") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: "Staff only.", ephemeral: true });
    }

    await interaction.reply({ content: `Claimed by ${interaction.user}` });
  }

  // ===== RENAME =====
  if (interaction.isButton() && interaction.customId === "rename") {

    const modal = new ModalBuilder()
      .setCustomId("rename_modal")
      .setTitle("Rename Ticket");

    const input = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("New channel name")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "rename_modal") {
    const newName = interaction.fields.getTextInputValue("name");

    await interaction.channel.setName(newName);

    return interaction.reply({ content: "Renamed!", ephemeral: true });
  }

  // ===== CLOSE =====
  if (interaction.isButton() && interaction.customId === "close") {

    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

    const messages = await interaction.channel.messages.fetch({ limit: 100 });

    let transcript = messages
      .map(m => `${m.author.tag}: ${m.content}`)
      .reverse()
      .join("\n");

    await logChannel.send({
      content: `Transcript for ${interaction.channel.name}\n\n${transcript}`
    });

    await interaction.reply({ content: "Closing ticket...", ephemeral: true });

    setTimeout(() => interaction.channel.delete(), 3000);
  }

});

client.login(TOKEN);
