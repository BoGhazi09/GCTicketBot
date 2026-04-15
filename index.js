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
const STAFF_ROLE = "1478564123259310090";
const CATEGORY_ID = "1488457065377824900";

// ===== ROLES =====
const WAR_ROLE = "1478560237794623583";
const ECO_ROLE = "1478560317494788188";
const SHOWCASE_ROLE = "1479969384289009696";
const FILLER_ROLE = "1491752366016561172";

// ===== CHANNEL MAP =====
const channelMap = {
  "1478552685706875160": { prefix: "war", role: WAR_ROLE },
  "1478556731306152098": { prefix: "aoo", role: WAR_ROLE },
  "1478556849124147381": { prefix: "strife", role: WAR_ROLE },

  "1478553096048345272": { prefix: "honor", role: ECO_ROLE },
  "1478556676259971142": { prefix: "forts", role: ECO_ROLE },
  "1478556700934930512": { prefix: "marauders", role: ECO_ROLE },

  "1491752594157080647": { prefix: "filler", role: FILLER_ROLE },
  "1479968874370961450": { prefix: "showcase", role: SHOWCASE_ROLE }
};

// ===== MEMORY =====
const baseName = new Map();

// ===== CLIENT =====
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
  console.log("Slash registered");
})();

client.once("ready", () => {
  console.log("Ready " + client.user.tag);
});

// ===== MAIN =====
client.on("interactionCreate", async (interaction) => {

  // PANEL
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

  // PANEL SUBMIT
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

  // CREATE TICKET
  if (interaction.isButton() && interaction.customId === "create_ticket") {

    try {
      const data = channelMap[interaction.channel.id];

      if (!data) {
        return interaction.reply({
          content: "Wrong channel",
          ephemeral: true
        });
      }

      const username = interaction.user.username.toLowerCase();
      const base = `${data.prefix}-${username}`;

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
            id: STAFF_ROLE,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          },
          {
            id: data.role,
            allow: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: OWNER_ROLE,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      baseName.set(channel.id, base);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("rename")
          .setLabel("Rename")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("close")
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await channel.send({
        content: `<@${interaction.user.id}> <@&${data.role}>`,
        allowedMentions: { parse: ["users", "roles"] },
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

    } catch (err) {
      console.log(err);

      if (!interaction.replied) {
        return interaction.reply({
          content: "Error creating ticket",
          ephemeral: true
        });
      }
    }
  }

  // PERMS
  function isStaff(member) {
    return (
      member.roles.cache.has(STAFF_ROLE) ||
      member.roles.cache.has(OWNER_ROLE)
    );
  }

  // RENAME (FIXED NO STACK)
  if (interaction.isButton() && interaction.customId === "rename") {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "No permission", ephemeral: true });
    }

    const original = baseName.get(interaction.channel.id);

    if (!original) {
      return interaction.reply({
        content: "Base name missing",
        ephemeral: true
      });
    }

    const newName = `${original}-${interaction.user.username.toLowerCase()}`;

    await interaction.channel.setName(newName).catch(() => {});

    return interaction.reply({
      content: `Renamed → ${newName}`
    });
  }

  // DELETE
  if (interaction.isButton() && interaction.customId === "close") {

    if (!interaction.member.roles.cache.has(OWNER_ROLE)) {
      return interaction.reply({
        content: "Only owner can delete",
        ephemeral: true
      });
    }

    await interaction.reply({ content: "Deleting..." });

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }

});

client.login(TOKEN);
