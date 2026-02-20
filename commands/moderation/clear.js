const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { isLoggingEnabled, getLoggingConfig } = require('../../core/logSettingsManager'); 

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime un certain nombre de messages.')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Le nombre de messages à supprimer (maximum 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Permission insuffisante")
          .setDescription("Désolé, tu n'as pas la permission de supprimer des messages.")
        ],
        ephemeral: true
      });
    }

    if (!interaction.guild.members.me.permissionsIn(interaction.channel).has([
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ReadMessageHistory
    ])) {
      return await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Permission insuffisante (BOT)")
          .setDescription("Je n'ai pas la permission de gérer ou lire les messages dans ce salon.")
        ],
        ephemeral: true
      });
    }

    const numberToDelete = interaction.options.getInteger('nombre');

    try {
      await interaction.deferReply({ ephemeral: true });
      const fetched = await interaction.channel.messages.fetch({ limit: numberToDelete });
      const deletable = fetched.filter(msg => (Date.now() - msg.createdTimestamp) < 1209600000);

      if (deletable.size === 0) {
        return await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("Aucun message supprimé")
            .setDescription("Tous les messages sélectionnés datent de plus de 14 jours.")
          ]
        });
      }

      const deletedMessages = await interaction.channel.bulkDelete(deletable, true);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle("Messages supprimés")
          .setDescription(`J'ai supprimé **${deletedMessages.size}** messages avec succès !`)
        ]
      });

      if (isLoggingEnabled(interaction.guild.id)) {
        const config = getLoggingConfig(interaction.guild.id);
        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('ℹ️  Log - Suppression de messages')
            .addFields(
              { name: '📦 Nombre supprimé', value: `${deletedMessages.size}`, inline: true },
              { name: '💬 Salon', value: `<#${interaction.channel.id}>`, inline: true },
              { name: '🛡️ Modérateur', value: `${interaction.user.tag}`, inline: true }
            )
            .setColor(0xFFA500)
            .setTimestamp();

          logChannel.send({ embeds: [logEmbed] });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la suppression des messages :', error);
      try {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("Erreur")
            .setDescription("Une erreur est survenue en supprimant les messages. Vérifie que j’ai bien les permissions et que les messages datent de moins de 14 jours.")
          ]
        });
      } catch (e) {}
    }
  },
};
