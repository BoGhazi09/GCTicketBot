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

// env
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// roles
const OWNER_ROLE = "1478554422303916185";
const WAR_ROLE = "1478560237794623583";
const ECO_ROLE = "1478560317494788188";
const SHOWCASE_ROLE = "1479969384289009696";
const FILLER_ROLE = "1491752366016561172";

// category (PUT YOUR CATEGORY ID)
const CATEGORY_ID = "1488457065377824900";

// channel mapping
const channelMap = {
  "1478552685706875160": { prefix: "war", role: WAR_ROLE },
  "1478556731306152098": { prefix: "war", role: WAR_ROLE },
  "1478556849124147381": { prefix: "war", role: WAR_ROLE },

  "1478556700934930512": { prefix: "eco", role: ECO_ROLE },
  "1478556676259971142": { prefix: "eco", role: ECO_ROLE },
  "1478553096048345272": { prefix: "eco", role: ECO_ROLE },

  "1479968874370961450": { prefix: "showcase", role: SHOWCASE_ROLE },

  "1491752594157080647": { prefix: "filler", role: FILLER_ROLE }
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// slash command
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send ticket panel")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

client.once("ready", () => {
  console.log("Ready " + client.user.tag);
});

// store claims
const claimed = new Map();

client.on("interactionCreate", async (interaction) => {

  // ===== PANEL =====
  if (interaction.isChatInputCommand()) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Create a Ticket")
          .setDescription("Click the button below")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("create_ticket")
            .setLabel("Create Ticket")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ===== CREATE TICKET =====
  if (interaction.isButton() && interaction.customId === "create_ticket") {

    const data = channelMap[interaction.channel.id];
    if (!data) return interaction.reply({ content: "Wrong channel", ephemeral: true });

    const name = `${data.prefix}-${interaction.user.username}`;

    const channel = await interaction.guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: data.role, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const buttons = new ActionRowBuilder().addComponents(
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
          .setDescription(`User: <@${interaction.user.id}>`)
      ],
      components: [buttons]
    });

    return interaction.reply({ content: `Created ${channel}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (interaction.isButton() && interaction.customId === "claim") {
    claimed.set(interaction.channel.id, interaction.user.id);

    return interaction.reply({ content: `Claimed by ${interaction.user}` });
  }

  // ===== PERMISSION CHECK =====
  function canManage(userId, member, channelId) {
    return (
      claimed.get(channelId) === userId ||
      member.roles.cache.has(OWNER_ROLE)
    );
  }

  // ===== UNCLAIM =====
  if (interaction.isButton() && interaction.customId === "unclaim") {
    if (!canManage(interaction.user.id, interaction.member, interaction.channel.id)) {
      return interaction.reply({ content: "Not yours", ephemeral: true });
    }

    claimed.delete(interaction.channel.id);
    return interaction.reply({ content: "Unclaimed" });
  }

  // ===== RENAME =====
  if (interaction.isButton() && interaction.customId === "rename") {
    if (!canManage(interaction.user.id, interaction.member, interaction.channel.id)) {
      return interaction.reply({ content: "Not yours", ephemeral: true });
    }

    await interaction.channel.setName(`renamed-${interaction.user.username}`);
    return interaction.reply({ content: "Renamed" });
  }

  // ===== CLOSE =====
  if (interaction.isButton() && interaction.customId === "close") {
    if (!canManage(interaction.user.id, interaction.member, interaction.channel.id)) {
      return interaction.reply({ content: "Not yours", ephemeral: true });
    }

    await interaction.reply({ content: "Closing..." });
    setTimeout(() => interaction.channel.delete(), 2000);
  }

});

client.login(TOKEN);
