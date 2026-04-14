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
  SlashCommandBuilder
} = require("discord.js");

const express = require("express");

// keep alive
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
  "1478556730934930512": { prefix: "war", role: "1478560237794623583" },
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

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("Create Ticket")
      .setDescription("Click below to open a ticket");

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
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
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

  // ===== UNCLAIM =====
  if (interaction.isButton() && interaction.customId === "unclaim") {

    const owner = interaction.member.roles.cache.has(OWNER_ROLE);
    const isClaimer = claimed.get(interaction.channel.id) === interaction.user.id;

    if (!owner && !isClaimer) {
      return interaction.reply({ content: "Not allowed", ephemeral: true });
    }

    claimed.set(interaction.channel.id, null);

    return interaction.reply({ content: "Unclaimed" });
  }

  // ===== RENAME (NO POPUP) =====
  if (interaction.isButton() && interaction.customId === "rename") {

    const owner = interaction.member.roles.cache.has(OWNER_ROLE);
    const isClaimer = claimed.get(interaction.channel.id) === interaction.user.id;

    if (!owner && !isClaimer) {
      return interaction.reply({ content: "Not allowed", ephemeral: true });
    }

    const base = baseName.get(interaction.channel.id) || interaction.channel.name;

    const newName = `${base}-${interaction.user.username}`;

    await interaction.channel.setName(newName);

    return interaction.reply({
      content: `Renamed to ${newName}`,
      ephemeral: true
    });
  }

  // ===== CLOSE =====
  if (interaction.isButton() && interaction.customId === "close") {

    const owner = interaction.member.roles.cache.has(OWNER_ROLE);
    const isClaimer = claimed.get(interaction.channel.id) === interaction.user.id;

    if (!owner && !isClaimer) {
      return interaction.reply({ content: "Not allowed", ephemeral: true });
    }

    await interaction.reply({ content: "Closing..." });

    setTimeout(() => interaction.channel.delete(), 2000);
  }

});

client.login(TOKEN);
