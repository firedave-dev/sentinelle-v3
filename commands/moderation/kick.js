const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getLoggingConfig, isLoggingEnabled } = require('../../core/logSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un utilisateur du serveur.')
    .addUserOption(option =>
      option.setName('utilisateur').setDescription('Utilisateur à expulser').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('id').setDescription('ID de l\'utilisateur à expulser').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('raison').setDescription('Raison de l\'expulsion')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ Cette commande ne peut être utilisée qu'à l'intérieur d'un serveur.",
        ephemeral: true
      });
    }

    const userOption = interaction.options.getUser('utilisateur');
    const userId = interaction.options.getString('id');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    if (!userOption && !userId) {
      return interaction.reply({
        content: '❌ Veuillez spécifier un utilisateur ou un ID.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      let member;
      let targetTag;
      const targetId = userOption ? userOption.id : userId;

      try {
        member = await interaction.guild.members.fetch(targetId);
      } catch (err) {
        return interaction.editReply({
          content: `❌ Aucun membre trouvé avec cet identifiant.`
        });
      }

      if (!member.kickable) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setDescription('❌ Impossible d\'expulser cet utilisateur (permissions insuffisantes ou rôle trop élevé).')
              .setColor('Red')
          ]
        });
      }

      targetTag = member.user.tag;

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🔨 Expulsion du serveur')
          .setDescription(`Vous avez été expulsé du serveur **${interaction.guild.name}**.`)
          .addFields({ name: '📩 Raison', value: reason })
          .setColor('Orange')
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.warn(`Impossible d'envoyer un message à ${targetTag} : ${err.message}`);
      }

      await member.kick(reason);

      const embed = new EmbedBuilder()
        .setTitle('🔨 Utilisateur expulsé')
        .setDescription(`**${targetTag}** a été expulsé.\n📩 Raison : ${reason}`)
        .setColor('Orange')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      if (isLoggingEnabled(interaction.guild.id)) {
        const config = getLoggingConfig(interaction.guild.id);
        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);

        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('ℹ️ Log - Expulsion')
            .addFields(
              { name: '👤 Utilisateur', value: targetTag, inline: true },
              { name: '🛡️ Modérateur', value: interaction.user.tag, inline: true },
              { name: '📩 Raison', value: reason }
            )
            .setColor('Orange')
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

    } catch (err) {
      console.error(err);
      
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: `❌ Une erreur est survenue : ${err.message}`
        });
      } else {
        return interaction.reply({
          content: `❌ Une erreur est survenue : ${err.message}`,
          ephemeral: true
        });
      }
    }
  }
};