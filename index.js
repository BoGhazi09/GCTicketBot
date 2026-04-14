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

// ===== SERVICE MAP =====
const channelMap = {
  "1478552685706875160": { prefix: "war" },
  "147855673209981051": { prefix: "aoo" },
  "1478556849124147381": { prefix: "strife" },

  "1478556676259971142": { prefix: "honor" },
  "1478553096048345272": { prefix: "forts" },

  "1478556700934930512": { prefix: "marauders" },

  "1491752594157080647": { prefix: "filler" },

  "1479968874370961450": { prefix: "showcase" }
};

// ===== MEMORY =====
const baseName = new Map();
const renameCount = new Map();

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ===== REGISTER COMMAND =====
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Create ticket panel")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash registered");
  } catch (e) {
    console.log(e);
  }
})();

client.once("ready", () => {
  console.log("Ready " + client.user.tag);
});

// ===== MAIN =====
client.on("interactionCreate", async (interaction) => {

  // ===== PANEL COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

    const modal = new ModalBuilder()
      .setCustomId("panel_modal")
      .setTitle("Create Panel");

    const title = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Title")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const desc = new TextInputBuilder()
      .setCustomId("desc")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(desc)
    );

    return interaction.showModal(modal);
  }

  // ===== PANEL SUBMIT =====
  if (interaction.isModalSubmit() && interaction.customId === "panel_modal") {

    const title = interaction.fields.getTextInputValue("title");
    const desc = interaction.fields.getTextInputValue("desc");

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(title)
      .setDescription(desc);

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
    if (!data) {
      return interaction.reply({ content: "Not panel channel", ephemeral: true });
    }

    const base = `${data.prefix}-${interaction.user.username}`;

    const channel = await interaction.guild.channels.create({
      name: base,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        }
      ]
    });

    baseName.set(channel.id, base);
    renameCount.set(channel.id, 0);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("rename")
        .setLabel("Rename")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [
        new EmbedBuilder()
          .setTitle("Ticket Opened")
          .setColor(0x2b2d31)
      ],
      components: [row]
    });

    await msg.pin().catch(() => {});

    return interaction.reply({
      content: `Created ${channel}`,
      ephemeral: true
    });
  }

  // ===== RENAME =====
  if (interaction.isButton() && interaction.customId === "rename") {

    const isStaff = interaction.member.roles.cache.has(OWNER_ROLE);
    if (!isStaff) {
      return interaction.reply({ content: "No permission", ephemeral: true });
    }

    const base = baseName.get(interaction.channel.id) || interaction.channel.name;

    let count = renameCount.get(interaction.channel.id) || 0;
    count++;

    renameCount.set(interaction.channel.id, count);

    const newName = `${base}-pilot${count}`;

    await interaction.channel.setName(newName).catch(() => {});

    return interaction.reply({
      content: `Renamed → ${newName}`,
      ephemeral: false
    });
  }

  // ===== DELETE =====
  if (interaction.isButton() && interaction.customId === "close") {

    const isStaff = interaction.member.roles.cache.has(OWNER_ROLE);
    if (!isStaff) {
      return interaction.reply({ content: "No permission", ephemeral: true });
    }

    await interaction.reply({ content: "Deleting..." });

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }

});

client.login(TOKEN);
