const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getLoggingConfig, isLoggingEnabled } = require('../../core/logSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannit un utilisateur via son ID.')
    .addStringOption(option =>
      option.setName('id').setDescription('ID de l’utilisateur à débannir').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison').setDescription('Raison du débannissement')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('id');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    try {
      const banList = await interaction.guild.bans.fetch();
      const bannedUser = banList.get(userId);

      if (!bannedUser) {
        return interaction.reply({
          content: '❌ Utilisateur non trouvé dans la liste des bannis.',
          ephemeral: true
        });
      }

      
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Débannissement du serveur')
          .setDescription(`Vous avez été débanni du serveur **${interaction.guild.name}**.`)
          .addFields({ name: '📩 Raison', value: reason })
          .setColor('Green')
          .setTimestamp();

        await bannedUser.user.send({ embeds: [dmEmbed] });
      } catch {
        console.warn(`Impossible d’envoyer un message à ${bannedUser.user.tag}.`);
      }

      await interaction.guild.bans.remove(userId, reason);

      const embed = new EmbedBuilder()
        .setTitle('✅ Utilisateur débanni')
        .setDescription(`**${bannedUser.user.tag}** a été débanni.\n📩 Raison : ${reason}`)
        .setColor('Green')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      
      if (isLoggingEnabled(interaction.guild.id)) {
        const config = getLoggingConfig(interaction.guild.id);
        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('ℹ️ Log - Débannissement')
            .addFields(
              { name: '👤 Utilisateur', value: bannedUser.user.tag, inline: true },
              { name: '🛡️ Modérateur', value: interaction.user.tag, inline: true },
              { name: '📩 Raison', value: reason }
            )
            .setColor('Green')
            .setTimestamp();
          logChannel.send({ embeds: [logEmbed] });
        }
      }

    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: `❌ Une erreur est survenue : ${error.message}`,
        ephemeral: true
      });
    }
  }
};
