const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolecreer')
    .setDescription('Créer un rôle interactivement')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    let roleName = null;
    let roleColor = '#0099ff';
    let rolePermissions = 0n;
    let rolePosition = 0;
    let roleMentionable = false;

    // Étape 1 : Nom du rôle
    const embed1 = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎭 Création de Rôle')
      .setDescription('**Étape 1/5 : Nom du rôle**\nQuel est le nom que tu souhaites donner au rôle ?\n\n*Répondez par un message dans le chat.*')
      .setFooter({ text: 'Timeout après 60 secondes' });

    await interaction.reply({ embeds: [embed1], ephemeral: true });

    const filter1 = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
    const collector1 = interaction.channel.createMessageCollector({ filter: filter1, max: 1, time: 60000 });

    collector1.on('collect', async (message) => {
      roleName = message.content.slice(0, 100);
      await message.delete().catch(() => {});

      // Étape 2 : Couleur personnalisée ou prédéfinie
      const colorButton = new ButtonBuilder()
        .setCustomId('color_custom')
        .setLabel('🎨 Couleur personnalisée')
        .setStyle(ButtonStyle.Primary);

      const colorPresetButton = new ButtonBuilder()
        .setCustomId('color_preset')
        .setLabel('🌈 Couleurs prédéfinies')
        .setStyle(ButtonStyle.Secondary);

      const row2 = new ActionRowBuilder().addComponents(colorButton, colorPresetButton);

      const embed2 = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎭 Création de Rôle')
        .setDescription('**Étape 2/5 : Couleur du rôle**\nChoisissez comment définir la couleur.')
        .addFields({ name: '✅ Nom', value: roleName });

      await interaction.editReply({ embeds: [embed2], components: [row2] });

      const buttonCollector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && (i.customId === 'color_custom' || i.customId === 'color_preset'),
        max: 1,
        time: 60000,
      });

      buttonCollector.on('collect', async (btnInteraction) => {
        if (btnInteraction.customId === 'color_custom') {
          await btnInteraction.update({
            embeds: [new EmbedBuilder()
              .setColor('#0099ff')
              .setTitle('🎭 Création de Rôle')
              .setDescription('**Étape 2/5 : Couleur personnalisée**\nEnvoyez un code couleur hexadécimal (ex: #FF5733)\n\n*Répondez par un message dans le chat.*')
              .addFields({ name: '✅ Nom', value: roleName })],
            components: []
          });

          const colorFilter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
          const colorCollector2 = interaction.channel.createMessageCollector({ filter: colorFilter, max: 1, time: 60000 });

          colorCollector2.on('collect', async (colorMsg) => {
            const colorInput = colorMsg.content.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(colorInput)) {
              roleColor = colorInput;
            } else {
              roleColor = '#0099ff';
            }
            await colorMsg.delete().catch(() => {});
            continueToPermissions();
          });
        } else {
          // Couleurs prédéfinies
          const colors = {
            '🔴 Rouge': '#FF0000',
            '🔵 Bleu': '#0000FF',
            '🟢 Vert': '#00FF00',
            '🟡 Jaune': '#FFFF00',
            '🟣 Violet': '#800080',
            '🟠 Orange': '#FFA500',
            '⚫ Noir': '#000000',
            '⚪ Blanc': '#FFFFFF',
            '💗 Rose': '#FF69B4',
            '🔷 Cyan': '#00FFFF',
            '🤎 Marron': '#8B4513',
            '🩶 Gris': '#808080',
            '💜 Magenta': '#FF00FF',
            '💛 Or': '#FFD700',
            '🩵 Bleu ciel': '#87CEEB',
            '🟥 Crimson': '#DC143C',
          };

          const colorSelect = new StringSelectMenuBuilder()
            .setCustomId('color_select')
            .setPlaceholder('Choisir une couleur...')
            .addOptions(
              Object.entries(colors).map(([label, colorHex]) =>
                ({ label, value: colorHex })
              )
            );

          const row = new ActionRowBuilder().addComponents(colorSelect);

          await btnInteraction.update({
            embeds: [new EmbedBuilder()
              .setColor('#0099ff')
              .setTitle('🎭 Création de Rôle')
              .setDescription('**Étape 2/5 : Couleur prédéfinie**\nChoisissez une couleur dans le menu.')
              .addFields({ name: '✅ Nom', value: roleName })],
            components: [row]
          });

          const colorCollector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'color_select',
            max: 1,
            time: 60000,
          });

          colorCollector.on('collect', async (i) => {
            await i.deferUpdate();
            roleColor = i.values[0];
            continueToPermissions();
          });
        }
      });

      async function continueToPermissions() {
        // Étape 3 : Permissions (sélection multiple)
        const permOptions = [
          { label: '⭐ Administrateur', value: String(PermissionFlagsBits.Administrator), description: 'Toutes les permissions' },
          { label: '🛡️ Expulser des membres', value: String(PermissionFlagsBits.KickMembers), description: 'Kick' },
          { label: '🔨 Bannir des membres', value: String(PermissionFlagsBits.BanMembers), description: 'Ban' },
          { label: '📢 Gérer les canaux', value: String(PermissionFlagsBits.ManageChannels), description: 'Créer/modifier canaux' },
          { label: '🖇️ Gérer le serveur', value: String(PermissionFlagsBits.ManageGuild), description: 'Paramètres serveur' },
          { label: '👥 Gérer les rôles', value: String(PermissionFlagsBits.ManageRoles), description: 'Créer/modifier rôles' },
          { label: '🛠️ Gérer les webhooks', value: String(PermissionFlagsBits.ManageWebhooks), description: 'Webhooks' },
          { label: '😀 Gérer les emojis', value: String(PermissionFlagsBits.ManageGuildExpressions), description: 'Emojis et stickers' },
          { label: '📋 Voir les logs', value: String(PermissionFlagsBits.ViewAuditLog), description: 'Historique serveur' },
          { label: '✉️ Envoyer des messages', value: String(PermissionFlagsBits.SendMessages), description: 'Écrire dans les salons' },
          { label: '🧹 Gérer les messages', value: String(PermissionFlagsBits.ManageMessages), description: 'Supprimer messages' },
          { label: '🔗 Intégrer des liens', value: String(PermissionFlagsBits.EmbedLinks), description: 'Aperçus de liens' },
          { label: '📎 Joindre des fichiers', value: String(PermissionFlagsBits.AttachFiles), description: 'Envoyer fichiers' },
          { label: '@️ Mentionner @everyone', value: String(PermissionFlagsBits.MentionEveryone), description: 'Ping @everyone/@here' },
          { label: '💬 Créer des threads', value: String(PermissionFlagsBits.CreatePublicThreads), description: 'Fils de discussion' },
          { label: '🎤 Se connecter (vocal)', value: String(PermissionFlagsBits.Connect), description: 'Rejoindre canaux vocaux' },
          { label: '🔊 Parler', value: String(PermissionFlagsBits.Speak), description: 'Parler en vocal' },
          { label: '📹 Vidéo', value: String(PermissionFlagsBits.Stream), description: 'Caméra/partage écran' },
          { label: '🔇 Rendre muet', value: String(PermissionFlagsBits.MuteMembers), description: 'Mute membres' },
          { label: '🔉 Assourdir', value: String(PermissionFlagsBits.DeafenMembers), description: 'Deafen membres' },
          { label: '🚪 Déplacer membres', value: String(PermissionFlagsBits.MoveMembers), description: 'Changer de salon vocal' },
          { label: '🎙️ Priorité orateur', value: String(PermissionFlagsBits.PrioritySpeaker), description: 'Voix prioritaire' },
          { label: '⏯️ Gérer évènements', value: String(PermissionFlagsBits.ManageEvents), description: 'Créer/modifier events' },
          { label: '⏱️ Timeout membres', value: String(PermissionFlagsBits.ModerateMembers), description: 'Exclure temporairement' },
          { label: '👁️ Voir canaux', value: String(PermissionFlagsBits.ViewChannel), description: 'Accès aux canaux' },
        ];

        const permSelect = new StringSelectMenuBuilder()
          .setCustomId('perm_select')
          .setPlaceholder('Sélectionner les permissions...')
          .setMinValues(0)
          .setMaxValues(Math.min(permOptions.length, 25))
          .addOptions(permOptions);

        const row3 = new ActionRowBuilder().addComponents(permSelect);

        const embed3 = new EmbedBuilder()
          .setColor(roleColor)
          .setTitle('🎭 Création de Rôle')
          .setDescription('**Étape 3/5 : Permissions**\nSélectionnez une ou plusieurs permissions.\n\n*Vous pouvez en choisir plusieurs !*')
          .addFields(
            { name: '✅ Nom', value: roleName },
            { name: '✅ Couleur', value: roleColor }
          );

        await interaction.editReply({ embeds: [embed3], components: [row3] });

        const permCollector = interaction.channel.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id && i.customId === 'perm_select',
          max: 1,
          time: 60000,
        });

        permCollector.on('collect', async (i) => {
          await i.deferUpdate();
          
          rolePermissions = i.values.reduce((acc, perm) => acc | BigInt(perm), 0n);
          const permCount = i.values.length;
          const permLabel = permCount === 0 ? '👤 Aucune permission' : `${permCount} permission(s) sélectionnée(s)`;

          // Étape 4 : Position
          const maxPosition = interaction.guild.roles.cache.size;
          const positionSelect = new StringSelectMenuBuilder()
            .setCustomId('position_select')
            .setPlaceholder('Choisir la position...')
            .addOptions([
              { label: '⬆️ Tout en haut', value: 'top', description: 'Position la plus haute possible' },
              { label: '⬆️ Haut', value: 'high', description: 'Dans le top 25%' },
              { label: '➡️ Milieu', value: 'middle', description: 'Au milieu de la liste' },
              { label: '⬇️ Bas', value: 'low', description: 'Dans le bas 25%' },
              { label: '⬇️ Tout en bas', value: 'bottom', description: 'Position la plus basse' }
            ]);

          const row4 = new ActionRowBuilder().addComponents(positionSelect);

          const embed4 = new EmbedBuilder()
            .setColor(roleColor)
            .setTitle('🎭 Création de Rôle')
            .setDescription('**Étape 4/5 : Position du rôle**\nChoisissez la position du rôle dans la hiérarchie.')
            .addFields(
              { name: '✅ Nom', value: roleName },
              { name: '✅ Couleur', value: roleColor },
              { name: '✅ Permissions', value: permLabel }
            );

          await interaction.editReply({ embeds: [embed4], components: [row4] });

          const posCollector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'position_select',
            max: 1,
            time: 60000,
          });

          posCollector.on('collect', async (i) => {
            await i.deferUpdate();
            
            switch(i.values[0]) {
              case 'top':
                rolePosition = Math.max(1, maxPosition - 1);
                break;
              case 'high':
                rolePosition = Math.floor(maxPosition * 0.75);
                break;
              case 'middle':
                rolePosition = Math.floor(maxPosition * 0.5);
                break;
              case 'low':
                rolePosition = Math.floor(maxPosition * 0.25);
                break;
              case 'bottom':
                rolePosition = 1;
                break;
            }

            // Étape 5 : Mentionnable
            const mentionSelect = new StringSelectMenuBuilder()
              .setCustomId('mention_select')
              .setPlaceholder('Mentionnable ?')
              .addOptions(
                { label: '✅ Oui', value: 'oui', description: 'Le rôle peut être mentionné' },
                { label: '❌ Non', value: 'non', description: 'Le rôle ne peut pas être mentionné' }
              );

            const row5 = new ActionRowBuilder().addComponents(mentionSelect);

            const embed5 = new EmbedBuilder()
              .setColor(roleColor)
              .setTitle('🎭 Création de Rôle')
              .setDescription('**Étape 5/5 : Mentionnable**\nLe rôle doit-il être mentionnable par @mention ?')
              .addFields(
                { name: '✅ Nom', value: roleName },
                { name: '✅ Couleur', value: roleColor },
                { name: '✅ Permissions', value: permLabel },
                { name: '✅ Position', value: i.values[0] === 'top' ? 'Tout en haut' : i.values[0] === 'high' ? 'Haut' : i.values[0] === 'middle' ? 'Milieu' : i.values[0] === 'low' ? 'Bas' : 'Tout en bas' }
              );

            await interaction.editReply({ embeds: [embed5], components: [row5] });

            const mentionCollector = interaction.channel.createMessageComponentCollector({
              filter: i => i.user.id === interaction.user.id && i.customId === 'mention_select',
              max: 1,
              time: 60000,
            });

            mentionCollector.on('collect', async (i) => {
              await i.deferUpdate();
              roleMentionable = i.values[0] === 'oui';

              // Créer le rôle
              try {
                const role = await interaction.guild.roles.create({
                  name: roleName,
                  color: roleColor,
                  permissions: rolePermissions,
                  mentionable: roleMentionable,
                  reason: `Rôle créé par ${interaction.user.tag}`
                });

                // Ajuster la position
                if (rolePosition > 1) {
                  await role.setPosition(rolePosition).catch(() => {});
                }

                const embedFinal = new EmbedBuilder()
                  .setColor(roleColor)
                  .setTitle('✅ Rôle créé avec succès !')
                  .setDescription(`Le rôle ${role} a été créé !`)
                  .addFields(
                    { name: '👤 Nom', value: role.name, inline: true },
                    { name: '🎨 Couleur', value: roleColor, inline: true },
                    { name: '🆔 ID', value: role.id, inline: true },
                    { name: '🔐 Permissions', value: permLabel, inline: true },
                    { name: '💬 Mentionnable', value: roleMentionable ? 'Oui' : 'Non', inline: true }
                  )
                  .setTimestamp();

                await interaction.editReply({ embeds: [embedFinal], components: [] });
              } catch (err) {
                await interaction.editReply({ content: `❌ Erreur lors de la création du rôle : ${err.message}`, embeds: [], components: [] });
              }
            });
          });
        });
      }
    });

    collector1.on('end', (collected) => {
      if (collected.size === 0) {
        interaction.followUp({ content: '⏱️ Temps écoulé !', ephemeral: true }).catch(() => {});
      }
    });
  }
};