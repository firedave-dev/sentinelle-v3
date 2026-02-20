const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ComponentType
} = require('discord.js');
const { getAntiRaidConfig, setAntiRaidOption } = require('../../core/antiraidStorage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configurer les protections anti-raid'),

  async execute(interaction) {
    
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: '❌ Cette commande ne peut être utilisée que dans un serveur.',
        ephemeral: true
      });
    }

    
    const guild = interaction.guild;
    if (!guild || !guild.id) {
      console.error('[ANTIRAID] Guild manquant ou invalide:', {
        guild: !!guild,
        guildId: guild?.id,
        guildName: guild?.name,
        userId: interaction.user?.id
      });
      return interaction.reply({
        content: '❌ Impossible de récupérer les informations du serveur. Veuillez réessayer.',
        ephemeral: true
      });
    }

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ Tu dois être **Administrateur** pour utiliser cette commande.',
        ephemeral: true
      });
    }

    let config;
    try {
      config = await getAntiRaidConfig(guild.id);
      
      
      if (!config) {
        console.log(`Aucune config anti-raid trouvée pour ${guild.name} (${guild.id}), initialisation...`);
        config = {
          channelManipulation: false,
          guildMemberAdd: false,
          messageCreate: false,
          roleDelete: false,
          aiAnalyzer: false,
          botAdd: false
        };
      }
      
    } catch (err) {
      console.error('Erreur lors de la récupération de la config anti-raid:', err);
      return interaction.reply({
        content: '❌ Une erreur est survenue lors de la récupération de la configuration.',
        ephemeral: true
      });
    }

    const protections = {
      channelManipulation: {
        emoji: '📁',
        name: 'Protection des salons',
        desc: 'Protection contre la modification de salons',
        limit: 'Ban automatique'
      },
      guildMemberAdd: {
        emoji: '👥',
        name: 'Protection des membres',
        desc: 'Protection contre les arrivées en masse',
        limit: 'Timeout 10min'
      },
      messageCreate: {
        emoji: '🔗',
        name: 'Anti-liens Discord',
        desc: 'Protection contre les liens discord.gg',
        limit: 'Timeout 3h'
      },
      roleDelete: {
        emoji: '🔒',
        name: 'Protection des rôles',
        desc: 'Protection contre la suppression des rôles',
        limit: 'Ban automatique'
      },
      aiAnalyzer: {
        emoji: '🤖',
        name: 'IA Anti-Raid',
        desc: 'IA adaptative anti-raid. Activez les logs pour l\'Intelligence Artificielle.',
        limit: 'Actions adaptatives'
      },
      botAdd: {
        emoji: '🚫',
        name: 'Anti-ajout de bots',
        desc: 'Kick automatique des bots ajoutés',
        limit: 'Kick immédiat'
      }
    };

    const buildEmbed = (timeLeft = 97) => {
      const activeCount = Object.values(config).filter(Boolean).length;
      const totalCount = Object.keys(protections).length;
      const securityLevel =
        totalCount === 0 ? '🟡 **Aucune protection**' :
        activeCount === 0 ? '🔴 **Critique**' :
        activeCount === totalCount ? '🟢 **Maximum**' : '🟠 **Élevé**';

      const embed = new EmbedBuilder()
        .setAuthor({
          name: '🛡️ Centre de Contrôle Anti-Raid',
          iconURL: 'https://cdn.discordapp.com/attachments/1142939200459649034/1388511695504281700/ChatGPT_Image_28_juin_2025_15_29_35.png?ex=68613fc9&is=685fee49&hm=981e3fbc78cc7b0de4f38756d1ed85575a49c93530f1907dfcdb3ddcac8ef18e&'
        })
        .setDescription('**Configuration avancée des protections de sécurité**\n*Sélectionnez une protection pour la modifier*')
        .setColor('#5865F2')
        .setThumbnail('https://cdn.discordapp.com/emojis/885420924083265616.png');

      embed.addFields({
        name: '📊 Tableau de Bord Sécurité',
        value: `**Protections Actives:** \`${activeCount}/${totalCount}\`\n**Niveau de Sécurité:** ${securityLevel}\n**Dernière Mise à Jour:** <t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: false
      });

      embed.addFields({
        name: '📁 Protection des Salons',
        value: `${config.channelManipulation ? '🟢 **Actif**' : '🔴 **Inactif**'} • **Action:** \`Ban automatique\`\n${config.channelManipulation ? '*Surveillance active*' : '*Vulnérable aux raids*'}`,
        inline: true
      });

      embed.addFields({
        name: '👥 Protection des Membres',
        value: `${config.guildMemberAdd ? '🟢 **Actif**' : '🔴 **Inactif**'} • **Action:** \`Timeout 10min\`\n${config.guildMemberAdd ? '*Surveillance active*' : '*Risque d\'infiltration*'}`,
        inline: true
      });

      embed.addFields({
        name: '🤖 IA Anti-Raid',
        value: `${config.aiAnalyzer ? '🟢 **Actif**' : '🔴 **Inactif**'} • **Action:** \`Adaptative\`\n${config.aiAnalyzer ? '*Analyse intelligente*' : '*Détection basique*'}`,
        inline: true
      });

      embed.addFields({
        name: '🔗 Anti-Liens Discord',
        value: `${config.messageCreate ? '🟢 **Actif**' : '🔴 **Inactif**'} • **Action:** \`Timeout 3h\`\n${config.messageCreate ? '*Liens surveillés*' : '*Liens non vérifiés*'}`,
        inline: true
      });

      embed.addFields({
        name: '🔒 Protection des Rôles',
        value: `${config.roleDelete ? '🟢 **Actif**' : '🔴 **Inactif**'} • **Action:** \`Ban automatique\`\n${config.roleDelete ? '*Surveillance active*' : '*Vulnérable aux raids*'}`,
        inline: true
      });

      embed.addFields({
        name: '🚫 Anti-Ajout de Bots',
        value: `${config.botAdd ? '🟢 **Actif**' : '🔴 **Inactif**'} • **Action:** \`Kick immédiat\`\n${config.botAdd ? '*Bots bloqués*' : '*Bots autorisés*'}`,
        inline: true
      });

      embed.setFooter({
        text: `🛡️ Système Anti-Raid v2.3 • Session: ${timeLeft}s • Serveur protégé depuis ${new Date().toLocaleDateString('fr-FR')}`
      });

      return embed;
    };

    const buildSelectMenu = () => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('toggle_protection')
        .setPlaceholder('🛠️ Sélectionner une protection à configurer')
        .addOptions(
          Object.entries(protections).map(([key, p]) => {
            const status = config[key] ? '🟢 ACTIF' : '🔴 INACTIF';
            return new StringSelectMenuOptionBuilder()
              .setLabel(`${p.name} • ${status}`)
              .setDescription(`${p.desc} • ${p.limit}`)
              .setValue(key)
              .setEmoji(p.emoji);
          })
        );
      return new ActionRowBuilder().addComponents(menu);
    };

    const buildButtons = () => {
      const allActive = Object.values(config).every(Boolean);
      const hasActive = Object.values(config).some(Boolean);

      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_all')
          .setLabel(allActive ? 'Désactiver tout' : 'Activer tout')
          .setStyle(allActive ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(allActive ? '❌' : '✅'),
        new ButtonBuilder()
          .setCustomId('export_config')
          .setLabel('Exporter config')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋')
          .setDisabled(!hasActive)
      );
    };

    const updateInterface = async () => {
      return {
        embeds: [buildEmbed(remainingTime)],
        components: [buildSelectMenu(), buildButtons()]
      };
    };

    await interaction.reply({
      embeds: [buildEmbed()],
      components: [buildSelectMenu(), buildButtons()],
      ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.MessageComponent,
      time: 97000,
      filter: i => i.user.id === interaction.user.id
    });

    let remainingTime = 97;
    const countdown = setInterval(async () => {
      remainingTime--;
      if (remainingTime <= 0) {
        clearInterval(countdown);
        return;
      }

      
      if (!guild || !guild.available || !guild.id) {
        clearInterval(countdown);
        console.log(`⚠️ Guild ${guild?.name || 'inconnu'} non disponible, arrêt du countdown`);
        return;
      }

      try {
        await interaction.editReply(await updateInterface());
      } catch (err) {
        clearInterval(countdown);
        console.error('Erreur lors de la mise à jour du countdown:', err);
      }
    }, 1000);

    collector.on('collect', async i => {
      try {
        
        if (!guild || !guild.id) {
          console.error('[ANTIRAID] Guild indisponible lors de collect');
          return await i.reply({
            content: '❌ Serveur indisponible. Veuillez réessayer.',
            ephemeral: true
          });
        }

        if (i.customId === 'toggle_protection') {
          const selected = i.values[0];
          const oldValue = config[selected];
          config[selected] = !config[selected];
          
          await setAntiRaidOption(guild.id, selected, config[selected]);
          
          console.log(`[ANTIRAID] ${i.user.tag} a ${config[selected] ? 'activé' : 'désactivé'} ${protections[selected].name} sur ${guild.name}`);
          
          
          const newInterface = {
            embeds: [buildEmbed(remainingTime)],
            components: [buildSelectMenu(), buildButtons()]
          };
          
          await i.update(newInterface);
          
          await i.followUp({
            content: `✅ ${protections[selected].name} est maintenant **${config[selected] ? 'activée' : 'désactivée'}**.`,
            ephemeral: true
          });
          
        } else if (i.customId === 'toggle_all') {
          
          
          const protectionKeysFromCode = Object.keys(protections);
          const protectionKeysFromConfig = Object.keys(config);
          const allPossibleKeys = [...new Set([...protectionKeysFromCode, ...protectionKeysFromConfig])];
          
          
          for (const key of allPossibleKeys) {
            if (!(key in config)) {
              config[key] = false; 
            }
          }
          
          
          const allCurrentlyActive = allPossibleKeys.every(key => config[key] === true);
          const enableAll = !allCurrentlyActive;
          
          console.log(`[ANTIRAID-DEBUG] Avant toggle: ${JSON.stringify(config)}`);
          console.log(`[ANTIRAID-DEBUG] Protections possibles: ${allPossibleKeys.join(', ')}`);
          console.log(`[ANTIRAID-DEBUG] allCurrentlyActive: ${allCurrentlyActive}, enableAll: ${enableAll}`);
          
          
          const changesCount = allPossibleKeys.filter(key => config[key] !== enableAll).length;
          
          
          for (const key of allPossibleKeys) {
            config[key] = enableAll;
            await setAntiRaidOption(guild.id, key, enableAll);
          }
          
          console.log(`[ANTIRAID-DEBUG] Après toggle: ${JSON.stringify(config)}`);
          console.log(`[ANTIRAID] ${i.user.tag} a ${enableAll ? 'activé' : 'désactivé'} toutes les protections (${changesCount} changements) sur ${guild.name}`);
          
          
          const newInterface = {
            embeds: [buildEmbed(remainingTime)],
            components: [buildSelectMenu(), buildButtons()]
          };
          
          await i.update(newInterface);
          
          await i.followUp({
            content: `🔁 **Toutes les protections ont été ${enableAll ? 'activées' : 'désactivées'}** (${changesCount} modifications appliquées).\n\n**Config:** ${Object.values(config).filter(Boolean).length}/${allPossibleKeys.length} protections actives`,
            ephemeral: true
          });

          
        } else if (i.customId === 'export_config') {
          
          if (Object.values(config).every(value => !value)) {
            return await i.reply({
              content: '❌ Aucune configuration anti-raid n\'est activée pour ce serveur.',
              ephemeral: true
            });
          }

          const activeProtections = Object.entries(config)
            .filter(([key, value]) => value)
            .map(([key]) => protections[key] ? protections[key].name : key);

          const configText = `**📋 Configuration Anti-Raid - ${guild.name}**\n\n` +
            `**Date d'export :** ${new Date().toLocaleString('fr-FR')}\n` +
            `**Protections actives :** ${activeProtections.length}/${Object.keys(protections).length}\n\n` +
            `**Détails des protections :**\n` +
            Object.entries(protections).map(([key, p]) =>
              `${config[key] ? '✅' : '❌'} **${p.name}**\n` +
              `   └ ${p.desc}\n` +
              `   └ Limite: ${p.limit}` 
            ).join('\n\n') +
            `\n\n**Configuration JSON :**\n\`\`\`json\n${JSON.stringify(config, null, 2)}\`\`\``;

          await i.reply({
            content: configText,
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Erreur dans le collector antiraid:', err);
        if (!i.replied && !i.deferred) {
          try {
            await i.reply({ 
              content: '❌ Erreur lors de la mise à jour de la configuration.', 
              ephemeral: true 
            });
          } catch (replyErr) {
            console.error('Impossible de répondre à l\'interaction:', replyErr);
          }
        }
      }
    });

    collector.on('end', async () => {
      clearInterval(countdown);
      try {
        if (!guild || !guild.available || !guild.id) {
          console.log(`⚠️ Impossible de nettoyer les composants: serveur ${guild?.name || 'inconnu'} indisponible`);
          return;
        }

        await interaction.editReply({ components: [] });
      } catch (e) {
        if (e.code === 50027) {
          console.log(`⚠️ Token webhook invalide pour ${guild?.name || 'serveur inconnu'} - Bot probablement kické`);
        } else if (e.code === 10008) {
          console.log(`⚠️ Message introuvable pour ${guild?.name || 'serveur inconnu'}`);
        } else if (e.code === 50001) {
          console.log(`⚠️ Accès manquant pour ${guild?.name || 'serveur inconnu'} - Bot probablement kické`);
        } else {
          console.error('Erreur suppression des composants :', e);
        }
      }
    });
  }
};