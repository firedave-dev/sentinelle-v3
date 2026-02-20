const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getLoggingConfig, isLoggingEnabled } = require('../../core/logSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowdown')
    .setDescription('Définit un délai entre chaque message dans un salon.')
    .addChannelOption(option =>
      option.setName('salon').setDescription('Salon à modifier').setRequired(true).addChannelTypes(ChannelType.GuildText)
    )
    .addIntegerOption(option =>
      option.setName('secondes').setDescription('Durée du slowmode (en secondes)').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const seconds = interaction.options.getInteger('secondes');

    if (seconds < 0 || seconds > 21600) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setDescription('❌ Le délai doit être compris entre 0 et 21600 secondes.').setColor('Red')],
        ephemeral: true
      });
    }

    await channel.setRateLimitPerUser(seconds);

    const embed = new EmbedBuilder()
      .setTitle('⌛ Slowmode modifié')
      .setDescription(`Le slowmode de <#${channel.id}> a été défini à **${seconds} seconde(s)**.`)
      .setColor('Blue')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    if (isLoggingEnabled(interaction.guild.id)) {
      const config = getLoggingConfig(interaction.guild.id);
      const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('ℹ️  Log - Slowmode modifié')
          .addFields(
            { name: '🛡️ Modérateur', value: interaction.user.tag, inline: true },
            { name: '💬 Salon', value: `<#${channel.id}>`, inline: true },
            { name: '⌛ Délai', value: `${seconds} seconde(s)` }
          )
          .setColor('Blue')
          .setTimestamp();
        logChannel.send({ embeds: [logEmbed] });
      }
    }
  }
};