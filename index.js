const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionsBitField
} = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const STAFF_ROLE_NAME = "CC";

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Verifica se o bot está online."),
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Envia o painel de atendimento.")
].map(c => c.toJSON());

client.once("clientReady", async () => {
  console.log(`Conectado como ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log("Comandos /ping e /ticketpanel registrados.");
});

function panel() {
  return new EmbedBuilder()
    .setTitle("🎫 Central de Atendimento Stumble Raid")
    .setDescription(
      "Selecione abaixo o motivo do seu atendimento.\n\n" +
      "📮 **Denúncias**\nAbusos xingamentos falas inapropriadas\n\n" +
      "❓ **Dúvidas**\nTire dúvidas Sobre o jogo Do servidor etc\n\n" +
      "🛒 **Compra**\nAqui você poderá comprar W ou até mesmo Nicks coloridos após abrir o ticket a resposta será direta sobre o valor dos produtos\n\n" +
      "🛡️ **Suporte**\nCaso tenha bugs no jogo ou Algo do tipo abra q iremos resolver"
    ).setFooter({ text: "Stumble Raid • Atendimento" });
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_denuncias").setLabel("📮 Denúncias").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_duvidas").setLabel("❓ Dúvidas").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket_compra").setLabel("🛒 Compra").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket_suporte").setLabel("🛡️ Suporte").setStyle(ButtonStyle.Secondary)
  );
}

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ping")
        return interaction.reply({ content: "🏓 Pong! O Stumble Raid está online.", ephemeral: true });

      if (interaction.commandName === "ticketpanel") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild))
          return interaction.reply({ content: "❌ Você precisa da permissão Gerenciar Servidor.", ephemeral: true });
        return interaction.reply({ embeds: [panel()], components: [buttons()] });
      }
    }

    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("ticket_") &&
        ["ticket_denuncias","ticket_duvidas","ticket_compra","ticket_suporte"].includes(interaction.customId)) {

      const type = interaction.customId.replace("ticket_", "");
      const existing = interaction.guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildText && ch.topic === `ticket:${interaction.user.id}`
      );
      if (existing)
        return interaction.reply({ content: `❌ Você já possui um ticket aberto: ${existing}`, ephemeral: true });

      const staffRole = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase()
      );

      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [
          PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles
        ]},
        { id: interaction.client.user.id, allow: [
          PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels
        ]}
      ];

      if (staffRole) overwrites.push({
        id: staffRole.id, allow: [
          PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles
        ]
      });

      const channel = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90),
        type: ChannelType.GuildText,
        topic: `ticket:${interaction.user.id}`,
        permissionOverwrites: overwrites
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle("🎫 Ticket aberto")
        .setDescription(`Olá ${interaction.user}!\n\n**Categoria:** ${type}\nExplique o que você precisa e aguarde a equipe.`);

      const staffEmbed = new EmbedBuilder()
        .setTitle("🛡️ Painel Staff")
        .setDescription("Use os botões abaixo para gerenciar este ticket.");

      const staffButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_assumir").setLabel("🛡️ Assumir Ticket").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_fechar").setLabel("🔴 Fechar Ticket").setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}${staffRole ? ` ${staffRole}` : ""}`,
        embeds: [ticketEmbed, staffEmbed],
        components: [staffButtons]
      });

      return interaction.reply({ content: `✅ Seu ticket foi criado: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === "ticket_assumir" || interaction.customId === "ticket_fechar") {
      const staffRole = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase()
      );
      if (!staffRole || !interaction.member.roles.cache.has(staffRole.id))
        return interaction.reply({ content: "❌ Apenas a equipe CC pode usar este botão.", ephemeral: true });

      if (interaction.customId === "ticket_assumir")
        return interaction.reply(`🛡️ Ticket assumido por ${interaction.user}.`);

      await interaction.reply("🔴 Ticket será fechado em 5 segundos.");
      setTimeout(() => interaction.channel.delete("Ticket fechado pela equipe").catch(console.error), 5000);
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred)
      await interaction.reply({ content: "❌ Ocorreu um erro.", ephemeral: true }).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN não foi encontrado.");
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
