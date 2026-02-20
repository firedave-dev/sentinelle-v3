const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
} = require('discord.js');
const { setLogging, getLoggingConfig, isLoggingEnabled, removeLoggingConfig } = require('../../core/logSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Active ou désactive le système de logs.')
    .addStringOption(option =>
      option.setName('état')
        .setDescription('Activer ou désactiver les logs')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const choice = interaction.options.getString('état');
    const guild = interaction.guild;
    const client = interaction.client;

    if (!guild) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur')
        .setDescription('Le bot n\'est plus dans ce serveur.')
        .setColor('Red');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    if (choice === 'off') {
      const config = getLoggingConfig(guild.id);
      const embed = new EmbedBuilder().setColor('Red').setTimestamp();

      if (!config || !config.logChannelId) {
        embed.setTitle('❌ Aucune configuration trouvée').setDescription('Aucun salon de logs configuré.');
      } else {
        removeLoggingConfig(guild.id);
        embed.setTitle('ℹ️ Logs désactivés').setDescription('Le système de logs a été désactivé.');
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (isLoggingEnabled(guild.id)) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Déjà actif')
        .setDescription('Le système de logs est déjà activé.')
        .setColor('Green');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const questionEmbed = new EmbedBuilder()
      .setTitle('ℹ️  Configuration des logs')
      .setDescription('Avez-vous déjà un salon de logs ?')
      .setColor('#3498db');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('log_exist_yes').setLabel('Oui').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('log_exist_no').setLabel('Non').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [questionEmbed], components: [row], ephemeral: true });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 30000,
      max: 1,
    });

    collector.on('collect', async i => {
      if (i.customId === 'log_exist_yes') {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_log_channel')
          .setPlaceholder('Choisissez un salon pour les logs')
          .addChannelTypes(ChannelType.GuildText);

        const rowSelect = new ActionRowBuilder().addComponents(channelSelect);

        const selectEmbed = new EmbedBuilder()
          .setTitle('📩 Sélection du salon')
          .setDescription('Choisissez un salon textuel existant pour les logs.')
          .setColor('Blue');

        await i.update({ embeds: [selectEmbed], components: [rowSelect], ephemeral: true });

        const selectCollector = interaction.channel.createMessageComponentCollector({
          filter: s => s.user.id === interaction.user.id,
          time: 30000,
          max: 1,
        });

        selectCollector.on('collect', async sel => {
          const selectedChannel = sel.channels.first();

          if (!selectedChannel) return;

          try {
            const embedInChannel = new EmbedBuilder()
              .setTitle('🤖  Système de logs activé')
              .setColor('#2ecc71')
              .setDescription('Les logs sont maintenant actifs.')
              .setTimestamp();

            await selectedChannel.send({ embeds: [embedInChannel] });
            setLogging(guild.id, true, selectedChannel.id);

            const successEmbed = new EmbedBuilder()
              .setTitle('✅ Succès')
              .setDescription(`Les logs sont maintenant actifs dans <#${selectedChannel.id}>.`)
              .setColor('Green');

            await sel.update({ embeds: [successEmbed], components: [], ephemeral: true });

          } catch (err) {
            console.error(err);
            const errEmbed = new EmbedBuilder()
              .setTitle('❌ Erreur')
              .setDescription('Impossible d\'envoyer un message dans ce salon.')
              .setColor('Red');
            await sel.update({ embeds: [errEmbed], ephemeral: true });
          }
        });

      } else if (i.customId === 'log_exist_no') {
        const confirmCreateEmbed = new EmbedBuilder()
          .setTitle('⚙️ Créer un salon ?')
          .setDescription('Voulez-vous que je crée un salon `logs` ?')
          .setColor('Orange');

        const rowCreate = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('log_create_yes').setLabel('Oui').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('log_create_no').setLabel('Non').setStyle(ButtonStyle.Danger),
        );

        await i.update({ embeds: [confirmCreateEmbed], components: [rowCreate], ephemeral: true });

        const subCollector = interaction.channel.createMessageComponentCollector({
          filter: btn => btn.user.id === interaction.user.id,
          time: 30000,
          max: 1,
        });

        subCollector.on('collect', async btn => {
          if (btn.customId === 'log_create_yes') {
            try {
              const logChannel = await guild.channels.create({
                name: 'logs',
                type: ChannelType.GuildText,
                topic: 'Salon de logs',
                permissionOverwrites: [
                  {
                    id: guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel],
                  },
                  {
                    id: client.user.id,
                    allow: [
                      PermissionFlagsBits.SendMessages,
                      PermissionFlagsBits.ViewChannel,
                      PermissionFlagsBits.EmbedLinks,
                    ],
                  },
                  ...guild.roles.cache
                    .filter(role => role.permissions.has(PermissionFlagsBits.ManageChannels))
                    .map(role => ({
                      id: role.id,
                      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    })),
                ],
              });

              const embedInChannel = new EmbedBuilder()
                .setTitle('🤖  Système de logs activé')
                .setColor('#2ecc71')
                .setDescription('Les logs sont maintenant actifs.')
                .setTimestamp();

              await logChannel.send({ embeds: [embedInChannel] });

              setLogging(guild.id, true, logChannel.id);

              const successEmbed = new EmbedBuilder()
                .setTitle('✅ Succès')
                .setDescription(`Salon <#${logChannel.id}> créé et les logs sont activés.`)
                .setColor('Green');

              await btn.update({ embeds: [successEmbed], components: [], ephemeral: true });

            } catch (err) {
              console.error(err);
              const errEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la création du salon.')
                .setColor('Red');
              await btn.update({ embeds: [errEmbed], ephemeral: true });
            }

          } else {
            const cancelEmbed = new EmbedBuilder()
              .setTitle('❌ Action annulée')
              .setDescription('Aucune action effectuée.')
              .setColor('Grey');
            await btn.update({ embeds: [cancelEmbed], ephemeral: true });
          }
        });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏱️ Temps écoulé')
          .setDescription('Aucune réponse détectée.')
          .setColor('Grey');
        interaction.editReply({ embeds: [timeoutEmbed], components: [], ephemeral: true });
      }
    });
  }
};