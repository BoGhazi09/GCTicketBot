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
  TextInputStyle
} = require("discord.js");

const express = require("express");

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(process.env.PORT || 3000);

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const OWNER_ROLE = "1478554422303916185";
const CATEGORY_ID = "1488457065377824900";

// channel map
const channelMap = {
  "1478552685706875160": { prefix: "war", role: "1478560237794623583" },
  "1478556731306152098": { prefix: "war", role: "1478560237794623583" },
  "1478556849124147381": { prefix: "war", role: "1478560237794623583" },

  "1478556700934930512": { prefix: "eco", role: "1478560317494788188" },
  "1478556676259971142": { prefix: "eco", role: "1478560317494788188" },
  "1478553096048345272": { prefix: "eco", role: "1478560317494788188" },

  "1479968874370961450": { prefix: "showcase", role: "1479969384289009696" },

  "1491752594157080647": { prefix: "filler", role: "1491752366016561172" }
};

// memory
const claimed = new Map();
const baseName = new Map();

// ===== BOT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ===== COMMAND =====
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Create ticket panel")
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

// ===== MAIN =====
client.on("interactionCreate", async (interaction) => {

  // ===== PANEL =====
  if (interaction.isChatInputCommand()) {

    const modal = new ModalBuilder()
      .setCustomId("panel_modal")
      .setTitle("Create Panel");

    const title = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Title")
      .setStyle(TextInputStyle.Short);

    const desc = new TextInputBuilder()
      .setCustomId("desc")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(desc)
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "panel_modal") {

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(interaction.fields.getTextInputValue("title"))
      .setDescription(interaction.fields.getTextInputValue("desc"));

    const btn = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("Create Ticket")
      .setStyle(ButtonStyle.Primary);

    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(btn)]
    });
  }

  // ===== CREATE TICKET =====
  if (interaction.isButton() && interaction.customId === "create_ticket") {

    const data = channelMap[interaction.channel.id];
    if (!data) return interaction.reply({ content: "Wrong channel", ephemeral: true });

    const base = `${data.prefix}-${interaction.user.username}`;

    const channel = await interaction.guild.channels.create({
      name: base,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: data.role, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    baseName.set(channel.id, base);
    claimed.set(channel.id, null);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("rename").setLabel("Rename").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@${interaction.user.id}> <@&${data.role}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Ticket Opened")
      ],
      components: [row]
    });

    return interaction.reply({ content: `Created ${channel}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (interaction.isButton() && interaction.customId === "claim") {
    claimed.set(interaction.channel.id, interaction.user.id);

    return interaction.reply({ content: `Claimed by ${interaction.user}` });
  }

  // ===== CHECK PERMS =====
  const isOwner = interaction.member.roles.cache.has(OWNER_ROLE);
  const isClaimer = claimed.get(interaction.channel.id) === interaction.user.id;

  // ===== RENAME BUTTON =====
  if (interaction.isButton() && interaction.customId === "rename") {

    if (!isOwner && !isClaimer) {
      return interaction.reply({ content: "Not allowed", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`rename_modal_${interaction.channel.id}`)
      .setTitle("Rename Ticket");

    const input = new TextInputBuilder()
      .setCustomId("tag")
      .setLabel("Name tag")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }

  // ===== RENAME FIXED =====
  if (interaction.isModalSubmit() && interaction.customId.startsWith("rename_modal_")) {

    const channelId = interaction.customId.split("_")[2];
    const tag = interaction.fields.getTextInputValue("tag");

    const base = baseName.get(channelId) || interaction.channel.name;

    const newName = `${base}-${tag}`;

    await interaction.channel.setName(newName);

    return interaction.reply({
      content: `Renamed to ${newName}`,
      ephemeral: true
    });
  }

  // ===== CLOSE =====
  if (interaction.isButton() && interaction.customId === "close") {

    if (!isOwner && !isClaimer) {
      return interaction.reply({ content: "Not allowed", ephemeral: true });
    }

    await interaction.reply({ content: "Closing..." });
    setTimeout(() => interaction.channel.delete(), 2000);
  }

});

client.login(TOKEN);
