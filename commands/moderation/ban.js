const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getLoggingConfig, isLoggingEnabled } = require('../../core/logSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un utilisateur.')
    .addUserOption(option =>
      option.setName('utilisateur').setDescription('Utilisateur à bannir').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('id').setDescription("ID de l'utilisateur à bannir").setRequired(false)
    )
    .addStringOption(option =>
      option.setName('raison').setDescription('Raison du bannissement')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ Cette commande ne peut être utilisée qu'à l'intérieur d'un serveur.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('utilisateur');
    const userId = interaction.options.getString('id');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    if (!user && !userId) {
      return interaction.reply({
        content: '❌ Veuillez fournir un utilisateur ou un ID.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      let bannedUser;
      const targetId = user ? user.id : userId;

      let targetUser = user;
      if (!targetUser) {
        try {
          targetUser = await interaction.client.users.fetch(userId);
        } catch (err) {
          return interaction.editReply({
            content: `❌ Aucun utilisateur trouvé avec l'ID ${userId}.`
          });
        }
      }

      try {
        const bans = await interaction.guild.bans.fetch();
        if (bans.has(targetId)) {
          return interaction.editReply({
            content: `❌ Cet utilisateur est déjà banni du serveur.`
          });
        }
      } catch (err) {
        console.error('Erreur lors de la vérification des bans :', err);
      }

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🔨 Bannissement du serveur')
          .setDescription(`Vous avez été banni du serveur **${interaction.guild.name}**.`)
          .addFields({ name: '📩 Raison', value: reason })
          .setColor('Red')
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.warn(`Impossible d'envoyer un message à ${targetUser.tag} : ${err.message}`);
      }

      try {
        await interaction.guild.members.ban(targetId, { reason });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Impossible de bannir cet utilisateur : ${err.message}`
        });
      }

      bannedUser = targetUser;

      const embed = new EmbedBuilder()
        .setTitle('🔨 Utilisateur banni')
        .setDescription(`**${bannedUser.tag}** a été banni.\n📩 Raison : ${reason}`)
        .setColor('Red')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      if (isLoggingEnabled(interaction.guild.id)) {
        const config = getLoggingConfig(interaction.guild.id);
        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);

        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('ℹ️ Log - Bannissement')
            .addFields(
              { name: '👤 Utilisateur', value: bannedUser.tag, inline: true },
              { name: '🛡️ Modérateur', value: interaction.user.tag, inline: true },
              { name: '📩 Raison', value: reason }
            )
            .setColor('Red')
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

    } catch (err) {
      console.error(err);
      
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: `❌ Une erreur est survenue lors du bannissement : ${err.message}`
        });
      } else {
        return interaction.reply({
          content: `❌ Une erreur est survenue lors du bannissement : ${err.message}`,
          ephemeral: true
        });
      }
    }
  }
};