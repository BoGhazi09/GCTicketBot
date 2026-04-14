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

// ===== keep alive =====
const app = express();
app.get("/", (req, res) => res.send("Ticket bot running"));
app.listen(process.env.PORT || 3000);

// ===== config =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const STAFF_ROLE_ID = "1478554422303916185";

// ===== bot =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ===== slash command =====
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

// ===== ready =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== interactions =====
client.on("interactionCreate", async (interaction) => {

  // send panel
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== "panel") return;

    const button = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("Create Ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("Support Tickets")
      .setDescription("Click the button below to open a ticket.");

    return interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }

  // create ticket
  if (interaction.isButton() && interaction.customId === "create_ticket") {
    const guild = interaction.guild;

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });

    const closeBtn = new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeBtn);

    await channel.send({
      content: `<@${interaction.user.id}> Welcome to your ticket.`,
      components: [row],
    });

    return interaction.reply({
      content: `Ticket created: ${channel}`,
      ephemeral: true,
    });
  }

  // close ticket
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    await interaction.reply({ content: "Closing ticket...", ephemeral: true });

    setTimeout(() => {
      interaction.channel.delete();
    }, 3000);
  }
});

// ===== login =====
client.login(TOKEN);
