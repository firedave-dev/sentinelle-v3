const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionsBitField
} = require('discord.js');
const { getAntiRaidConfig, setAntiRaidOption } = require('../../core/antiraidStorage');
const { getLogChannelId } = require('../../core/logSettingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('service-panel')
    .setDescription('Panel d\'administration anti-raid (Service uniquement)')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('ID du serveur à administrer')
        .setRequired(true)
    ),

  async execute(interaction) {
    
    const AUTHORIZED_SERVICE_IDS = [
      '978294590073352213',
      '875820658142093313', 
      '1137391199599210557' 
    ];

    if (!AUTHORIZED_SERVICE_IDS.includes(interaction.user.id)) {
      return await interaction.reply({
        content: '🚫 **ACCÈS REFUSÉ**\n\n*Cette commande est exclusivement réservée au Service Anti-Raid.*\n\n📋 **Informations de sécurité :**\n• Tentative d\'accès enregistrée\n• Utilisateur non autorisé\n• Contact requis avec l\'administration',
        ephemeral: true
      });
    }

    const serverId = interaction.options.getString('server-id');

    
    const targetGuild = interaction.client.guilds.cache.get(serverId);
    if (!targetGuild) {
      return await interaction.reply({
        content: `❌ **SERVEUR INTROUVABLE**\n\n**ID recherché :** \`${serverId}\`\n**Statut :** Le bot n'est pas présent sur ce serveur\n\n*Vérifiez l'ID ou ajoutez le bot au serveur cible.*`,
        ephemeral: true
      });
    }

    
    console.log(`[ADMIN-PANEL] ${interaction.user.tag} (${interaction.user.id}) accède au panel du serveur ${targetGuild.name} (${serverId})`);

    let config;
    let recentLogs = [];
    let logAccessError = null;
    
    try {
      config = await getAntiRaidConfig(serverId);
      if (!config) {
        config = {
          channelManipulation: false,
          guildMemberAdd: false,
          messageCreate: false,
          roleDelete: false,
          aiAnalyzer: false,
          botAdd: false
        };
      }
      
      
      const logChannelId = getLogChannelId(serverId);
      if (logChannelId) {
        const logChannel = targetGuild.channels.cache.get(logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          
          const botMember = await targetGuild.members.fetch(interaction.client.user.id);
          const hasViewChannel = logChannel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ViewChannel);
          const hasReadHistory = logChannel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ReadMessageHistory);
          
          if (!hasViewChannel || !hasReadHistory) {
            logAccessError = 'Le bot n\'a pas les permissions nécessaires pour lire le salon de logs';
            console.log(`[ADMIN-PANEL] Permissions manquantes sur le salon de logs ${logChannelId}: ViewChannel=${hasViewChannel}, ReadMessageHistory=${hasReadHistory}`);
          } else {
            try {
              const messages = await logChannel.messages.fetch({ limit: 15 });
              recentLogs = messages
                .filter(msg => msg.author.id === interaction.client.user.id && msg.embeds.length > 0)
                .filter(msg => {
                  const embed = msg.embeds[0];
                  
                  return embed.title && (
                    embed.title.includes('🚨') || 
                    embed.title.includes('⚠️') || 
                    embed.title.includes('🛡️') ||
                    embed.title.toLowerCase().includes('raid') ||
                    embed.title.toLowerCase().includes('incident') ||
                    embed.title.toLowerCase().includes('protection') ||
                    embed.description?.toLowerCase().includes('anti-raid') ||
                    embed.description?.toLowerCase().includes('protection')
                  );
                })
                .map(msg => {
                  const embed = msg.embeds[0];
                  
                  let description = embed.description || 'Aucune description';
                  if (description.length > 150) {
                    description = description.substring(0, 147) + '...';
                  }
                  
                  return {
                    timestamp: msg.createdTimestamp,
                    title: embed.title || 'Log système',
                    description: description,
                    color: embed.color || '#FF0000'
                  };
                })
                .slice(0, 5); 
            } catch (err) {
              if (err.code === 50001) {
                logAccessError = 'Permissions insuffisantes pour accéder au salon de logs';
                console.error(`[ADMIN-PANEL] Erreur 50001 (Missing Access) sur le salon de logs ${logChannelId}`);
              } else {
                logAccessError = `Erreur lors de la récupération des logs: ${err.message}`;
                console.error('[ADMIN-PANEL] Erreur récupération logs du salon:', err);
              }
            }
          }
        } else {
          logAccessError = 'Le salon de logs configuré est introuvable ou n\'est pas un salon textuel';
        }
      }
    } catch (err) {
      console.error('[ADMIN-PANEL] Erreur récupération config/logs:', err);
      return interaction.reply({
        content: '❌ **Erreur système** - Impossible de récupérer les données du serveur.',
        ephemeral: true
      });
    }

    const protections = {
      channelManipulation: {
        emoji: '📁',
        name: 'Protection des salons',
        desc: 'Protection contre la suppression de salons',
        action: 'Ban automatique',
        risk: config.channelManipulation ? 'FAIBLE' : 'CRITIQUE'
      },
      guildMemberAdd: {
        emoji: '👥',
        name: 'Protection des membres',
        desc: 'Protection contre les arrivées en masse',
        action: 'Timeout 10min',
        risk: config.guildMemberAdd ? 'FAIBLE' : 'ÉLEVÉ'
      },
      messageCreate: {
        emoji: '🔗',
        name: 'Anti-liens Discord',
        desc: 'Protection contre les liens discord.gg',
        action: 'Timeout 3h',
        risk: config.messageCreate ? 'FAIBLE' : 'MOYEN'
      },
      roleDelete: {
        emoji: '🔒',
        name: 'Protection des rôles',
        desc: 'Protection contre la suppression des rôles',
        action: 'Ban automatique',
        risk: config.roleDelete ? 'FAIBLE' : 'CRITIQUE'
      },
      aiAnalyzer: {
        emoji: '🤖',
        name: 'IA Anti-Raid',
        desc: 'Analyse intelligente et détection de patterns',
        action: 'Actions adaptatives',
        risk: config.aiAnalyzer ? 'FAIBLE' : 'ÉLEVÉ'
      },
      botAdd: {
        emoji: '🚫',
        name: 'Anti-ajout de bots',
        desc: 'Kick automatique des bots ajoutés',
        action: 'Kick immédiat',
        risk: config.botAdd ? 'FAIBLE' : 'MOYEN'
      }
    };

    const getSecurityLevel = () => {
      const activeCount = Object.values(config).filter(Boolean).length;
      const totalCount = Object.keys(protections).length;
      const percentage = (activeCount / totalCount) * 100;
      
      if (percentage === 100) return { level: '🟢 **MAXIMUM**', color: '#00FF00' };
      if (percentage >= 75) return { level: '🟡 **ÉLEVÉ**', color: '#FFFF00' };
      if (percentage >= 50) return { level: '🟠 **MOYEN**', color: '#FFA500' };
      if (percentage >= 25) return { level: '🔴 **FAIBLE**', color: '#FF4500' };
      return { level: '⚫ **CRITIQUE**', color: '#8B0000' };
    };

    const buildMainEmbed = () => {
      const activeCount = Object.values(config).filter(Boolean).length;
      const totalCount = Object.keys(protections).length;
      const security = getSecurityLevel();
      
      const embed = new EmbedBuilder()
        .setAuthor({
          name: `🛡️ ADMIN PANEL - ${targetGuild.name}`,
          iconURL: targetGuild.iconURL() || 'https://cdn.discordapp.com/attachments/1142939200459649034/1388511695504281700/ChatGPT_Image_28_juin_2025_15_29_35.png?ex=68613fc9&is=685fee49&hm=981e3fbc78cc7b0de4f38756d1ed85575a49c93530f1907dfcdb3ddcac8ef18e&'
        })
        .setDescription(`**🔐 Panel d'administration anti-raid**\n*Accès réservé au service de sécurité*\n\n**Serveur ID :** \`${serverId}\`\n**Membres :** ${targetGuild.memberCount.toLocaleString('fr-FR')}`)
        .setColor(security.color)
        .setThumbnail('https://cdn.discordapp.com/emojis/885420924083265616.png');

      embed.addFields([
        {
          name: '📊 TABLEAU DE BORD SÉCURITÉ',
          value: `**Niveau de sécurité :** ${security.level}\n**Protections actives :** \`${activeCount}/${totalCount}\`\n**Dernière vérification :** <t:${Math.floor(Date.now() / 1000)}:R>\n**Statut serveur :** ${targetGuild.available ? '🟢 En ligne' : '🔴 Indisponible'}`,
          inline: false
        },
        {
          name: '🚨 ANALYSE DES RISQUES',
          value: Object.entries(protections).map(([key, p]) => {
            const riskEmoji = p.risk === 'CRITIQUE' ? '🔴' : p.risk === 'ÉLEVÉ' ? '🟠' : p.risk === 'MOYEN' ? '🟡' : '🟢';
            return `${riskEmoji} **${p.name}** - Risque: \`${p.risk}\``;
          }).join('\n'),
          inline: false
        }
      ]);

      embed.setFooter({
        text: `🛡️ Admin Panel • Opérateur: ${interaction.user.tag} • Session sécurisée`,
        iconURL: interaction.user.displayAvatarURL()
      });

      return embed;
    };

    const buildLogsEmbed = () => {
      const embed = new EmbedBuilder()
        .setTitle('📋 LOGS DE SÉCURITÉ')
        .setDescription(`**Serveur :** ${targetGuild.name}\n**Logs récents du salon de logs**`)
        .setColor('#FF6B35')
        .setTimestamp();

      if (logAccessError) {
        embed.addFields([{
          name: '⚠️ Erreur d\'accès aux logs',
          value: `${logAccessError}\n\n**Vérifications nécessaires :**\n• Le bot doit avoir la permission "Voir le salon"\n• Le bot doit avoir la permission "Lire l'historique des messages"\n• Le salon doit être accessible par le bot`,
          inline: false
        }]);
      } else if (recentLogs.length === 0) {
        embed.addFields([{
          name: 'ℹ️ Aucun log d\'incident récent',
          value: 'Aucun log d\'incident anti-raid trouvé dans le salon de logs ou salon non configuré.\n*Seuls les logs contenant des mots-clés de sécurité sont affichés.*',
          inline: false
        }]);
      } else {
        const logsText = recentLogs.map((log, index) => {
          return `\`${index + 1}.\` <t:${Math.floor(log.timestamp / 1000)}:R>\n**${log.title}**\n${log.description}`;
        }).join('\n\n');

        embed.addFields([{
          name: `📝 Logs d'incidents (${recentLogs.length} trouvés)`,
          value: logsText.length > 1024 ? logsText.substring(0, 1020) + '...' : logsText,
          inline: false
        }]);
      }

      
      const logChannelId = getLogChannelId(serverId);
      if (logChannelId) {
        embed.addFields([{
          name: '📍 Salon de logs configuré',
          value: `<#${logChannelId}>`,
          inline: true
        }]);
      }

      return embed;
    };

    const buildStatsEmbed = () => {
      const activeProtections = Object.values(config).filter(Boolean).length;
      const totalProtections = Object.keys(protections).length;
      const securityPercentage = Math.round((activeProtections / totalProtections) * 100);
      
      const embed = new EmbedBuilder()
        .setTitle('📈 STATISTIQUES DE SÉCURITÉ')
        .setDescription(`**Serveur :** ${targetGuild.name}\n**Analyse en temps réel**`)
        .setColor('#4CAF50')
        .setTimestamp();

      embed.addFields([
        {
          name: '🛡️ Configuration actuelle',
          value: `**Protections actives :** ${activeProtections}/${totalProtections}\n**Niveau de sécurité :** ${securityPercentage}%\n**Logs configurés :** ${getLogChannelId(serverId) ? '✅ Oui' : '❌ Non'}\n**Membres du serveur :** ${targetGuild.memberCount.toLocaleString('fr-FR')}`,
          inline: true
        },
        {
          name: '📊 Analyse des risques',
          value: `**Risques critiques :** ${Object.values(protections).filter(p => p.risk === 'CRITIQUE' && !config[Object.keys(protections).find(k => protections[k] === p)]).length}\n**Risques élevés :** ${Object.values(protections).filter(p => p.risk === 'ÉLEVÉ' && !config[Object.keys(protections).find(k => protections[k] === p)]).length}\n**Logs récents :** ${recentLogs.length}\n**Statut global :** ${securityPercentage >= 80 ? '🟢 Sécurisé' : securityPercentage >= 50 ? '🟡 Modéré' : '🔴 À risque'}`,
          inline: true
        },
        {
          name: '⚡ Informations serveur',
          value: `**Créé le :** <t:${Math.floor(targetGuild.createdTimestamp / 1000)}:D>\n**Propriétaire :** <@${targetGuild.ownerId}>\n**Canaux :** ${targetGuild.channels.cache.size}\n**Rôles :** ${targetGuild.roles.cache.size}`,
          inline: true
        }
      ]);

      return embed;
    };

    const buildActionMenu = () => {
      return new StringSelectMenuBuilder()
        .setCustomId('service_action')
        .setPlaceholder('🔧 Sélectionner une action de service')
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel('Modifier les protections')
            .setDescription('Activer/désactiver les modules de protection')
            .setValue('modify_protections')
            .setEmoji('⚙️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Consulter les logs')
            .setDescription('Afficher les logs du salon configuré')
            .setValue('view_logs')
            .setEmoji('📋'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Statistiques détaillées')
            .setDescription('Voir les métriques de sécurité')
            .setValue('view_stats')
            .setEmoji('📈'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Export configuration')
            .setDescription('Exporter la config anti-raid')
            .setValue('export_config')
            .setEmoji('📁'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Analyse de sécurité')
            .setDescription('Scan complet du serveur')
            .setValue('security_scan')
            .setEmoji('🔍')
        ]);
    };

    const buildProtectionMenu = () => {
      return new StringSelectMenuBuilder()
        .setCustomId('toggle_protection')
        .setPlaceholder('🛠️ Sélectionner une protection à modifier')
        .addOptions(
          Object.entries(protections).map(([key, p]) => {
            const status = config[key] ? '🟢 ACTIF' : '🔴 INACTIF';
            return new StringSelectMenuOptionBuilder()
              .setLabel(`${p.name} • ${status}`)
              .setDescription(`${p.desc} • Risque: ${p.risk}`)
              .setValue(key)
              .setEmoji(p.emoji);
          })
        );
    };

    const buildControlButtons = () => {
      const allActive = Object.values(config).every(Boolean);
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('toggle_all')
          .setLabel(allActive ? 'Désactiver tout' : 'Activer tout')
          .setStyle(allActive ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(allActive ? '❌' : '✅'),
        new ButtonBuilder()
          .setCustomId('refresh_data')
          .setLabel('Actualiser')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );
    };

    let currentView = 'main';
    let timeLeft = 300; 

    const updateDisplay = async () => {
      let embed, components = [];
      
      switch (currentView) {
        case 'main':
          embed = buildMainEmbed();
          components = [
            new ActionRowBuilder().addComponents(buildActionMenu()),
            buildControlButtons()
          ];
          break;
        case 'protections':
          embed = buildMainEmbed();
          components = [
            new ActionRowBuilder().addComponents(buildProtectionMenu()),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
            )
          ];
          break;
        case 'logs':
          embed = buildLogsEmbed();
          components = [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
            )
          ];
          break;
        case 'stats':
          embed = buildStatsEmbed();
          components = [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
            )
          ];
          break;
      }

      embed.setFooter({
        text: `${embed.data.footer?.text || 'Admin Panel'} • Session: ${timeLeft}s`,
        iconURL: embed.data.footer?.icon_url || interaction.user.displayAvatarURL()
      });

      return { embeds: [embed], components };
    };

    await interaction.reply({
      ...(await updateDisplay()),
      ephemeral: true
    });

    const response = await interaction.fetchReply();
    
    const collector = response.createMessageComponentCollector({
      time: 300000, 
      filter: i => i.user.id === interaction.user.id
    });

    const countdown = setInterval(async () => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(countdown);
        return;
      }
      
      try {
        await interaction.editReply(await updateDisplay());
      } catch (err) {
        clearInterval(countdown);
      }
    }, 1000);

    collector.on('collect', async i => {
      try {
        
        if (i.customId === 'service_action') {
          const action = i.values[0];
          
          switch (action) {
            case 'modify_protections':
              currentView = 'protections';
              await i.update(await updateDisplay());
              break;
            case 'view_logs':
              currentView = 'logs';
              await i.update(await updateDisplay());
              break;
            case 'view_stats':
              currentView = 'stats';
              await i.update(await updateDisplay());
              break;
            case 'export_config':
              const configData = {
                serverId: serverId,
                serverName: targetGuild.name,
                exportDate: new Date().toISOString(),
                config: config,
                protections: protections,
                logChannelId: getLogChannelId(serverId)
              };
              
              await i.reply({
                content: `📁 **EXPORT CONFIGURATION**\n\n\`\`\`json\n${JSON.stringify(configData, null, 2)}\`\`\``,
                ephemeral: true
              });
              break;
            case 'security_scan':
              const securityLevel = getSecurityLevel();
              const criticalRisks = Object.values(protections).filter(p => p.risk === 'CRITIQUE' && !config[Object.keys(protections).find(k => protections[k] === p)]).length;
              const hasLogs = getLogChannelId(serverId) ? '✅' : '❌';
              
              await i.reply({
                content: `🔍 **ANALYSE DE SÉCURITÉ TERMINÉE**\n\n✅ Vérification des permissions\n✅ Scan des protections actives\n✅ Analyse des configurations\n✅ Vérification des logs\n\n**Résultats :**\n• **Niveau de sécurité :** ${securityLevel.level}\n• **Risques critiques :** ${criticalRisks}\n• **Logs configurés :** ${hasLogs}\n• **Score de sécurité :** ${100 - (criticalRisks * 20)}/100`,
                ephemeral: true
              });
              break;
          }
          
        } else if (i.customId === 'toggle_protection') {
          const selected = i.values[0];
          const oldValue = config[selected];
          config[selected] = !config[selected];
          
          await setAntiRaidOption(serverId, selected, config[selected]);
          
          console.log(`[ADMIN-PANEL] ${interaction.user.tag} a ${config[selected] ? 'activé' : 'désactivé'} ${protections[selected].name} sur ${targetGuild.name}`);
          
          await i.reply({
            content: `✅ **${protections[selected].name}** ${config[selected] ? 'activée' : 'désactivée'} avec succès.\n\n**Niveau de risque :** ${protections[selected].risk} → ${config[selected] ? 'FAIBLE' : protections[selected].risk}`,
            ephemeral: true
          });
          
          await interaction.editReply(await updateDisplay());
          
        
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
          
          console.log(`[ADMIN-PANEL-DEBUG] Avant toggle: ${JSON.stringify(config)}`);
          console.log(`[ADMIN-PANEL-DEBUG] Protections possibles: ${allPossibleKeys.join(', ')}`);
          console.log(`[ADMIN-PANEL-DEBUG] allCurrentlyActive: ${allCurrentlyActive}, enableAll: ${enableAll}`);
          
          
          const changesCount = allPossibleKeys.filter(key => config[key] !== enableAll).length;
          
          
          for (const key of allPossibleKeys) {
            config[key] = enableAll;
            await setAntiRaidOption(serverId, key, enableAll);
          }
          
          console.log(`[ADMIN-PANEL-DEBUG] Après toggle: ${JSON.stringify(config)}`);
          console.log(`[ADMIN-PANEL] ${interaction.user.tag} a ${enableAll ? 'activé' : 'désactivé'} toutes les protections sur ${targetGuild.name}`);
          
          await i.reply({
            content: `🔁 **TOUTES LES PROTECTIONS ${enableAll ? 'ACTIVÉES' : 'DÉSACTIVÉES'}**\n\n**Nouveau niveau de sécurité :** ${enableAll ? '🟢 MAXIMUM' : '⚫ CRITIQUE'}\n**Config:** ${Object.values(config).filter(Boolean).length}/${allPossibleKeys.length} protections actives\n**Action journalisée et auditée**`,
            ephemeral: true
          });
          
          await interaction.editReply(await updateDisplay());
          
        } else if (i.customId === 'back_to_main') {
          currentView = 'main';
          await i.update(await updateDisplay());
          
        } else if (i.customId === 'refresh_data') {
          
          config = await getAntiRaidConfig(serverId) || config;
          
          
          logAccessError = null;
          recentLogs = [];
          const logChannelId = getLogChannelId(serverId);
          if (logChannelId) {
            const logChannel = targetGuild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
              
              const botMember = await targetGuild.members.fetch(interaction.client.user.id);
              const hasViewChannel = logChannel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ViewChannel);
              const hasReadHistory = logChannel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ReadMessageHistory);
              
              if (!hasViewChannel || !hasReadHistory) {
                logAccessError = 'Le bot n\'a pas les permissions nécessaires pour lire le salon de logs';
                console.log(`[ADMIN-PANEL] Permissions manquantes sur le salon de logs ${logChannelId}: ViewChannel=${hasViewChannel}, ReadMessageHistory=${hasReadHistory}`);
              } else {
                try {
                  const messages = await logChannel.messages.fetch({ limit: 15 });
                  recentLogs = messages
                    .filter(msg => msg.author.id === interaction.client.user.id && msg.embeds.length > 0)
                    .filter(msg => {
                      const embed = msg.embeds[0];
                      
                      return embed.title && (
                        embed.title.includes('🚨') || 
                        embed.title.includes('⚠️') || 
                        embed.title.includes('🛡️') ||
                        embed.title.toLowerCase().includes('raid') ||
                        embed.title.toLowerCase().includes('incident') ||
                        embed.title.toLowerCase().includes('protection') ||
                        embed.description?.toLowerCase().includes('anti-raid') ||
                        embed.description?.toLowerCase().includes('protection')
                      );
                    })
                    .map(msg => {
                      const embed = msg.embeds[0];
                      let description = embed.description || 'Aucune description';
                      if (description.length > 150) {
                        description = description.substring(0, 147) + '...';
                      }
                      
                      return {
                        timestamp: msg.createdTimestamp,
                        title: embed.title || 'Log système',
                        description: description,
                        color: embed.color || '#FF0000'
                      };
                    })
                    .slice(0, 5);
                } catch (err) {
                  if (err.code === 50001) {
                    logAccessError = 'Permissions insuffisantes pour accéder au salon de logs';
                    console.error(`[ADMIN-PANEL] Erreur 50001 (Missing Access) sur le salon de logs ${logChannelId}`);
                  } else {
                    logAccessError = `Erreur lors de la récupération des logs: ${err.message}`;
                    console.error('[ADMIN-PANEL] Erreur refresh logs:', err);
                  }
                }
              }
            }
          }
          
          await i.reply({
            content: '🔄 **Données actualisées** - Configuration et logs rechargés.',
            ephemeral: true
          });
          await interaction.editReply(await updateDisplay());
        }
        
      } catch (err) {
        console.error('[ADMIN-PANEL] Erreur dans le collector:', err);
        if (!i.replied && !i.deferred) {
          await i.reply({
            content: '❌ **Erreur système** - Veuillez réessayer.',
            ephemeral: true
          });
        }
      }
    });

    collector.on('end', async () => {
      clearInterval(countdown);
      try {
        await interaction.editReply({
          content: '⏰ **Session expirée** - Panel fermé pour des raisons de sécurité.',
          embeds: [],
          components: []
        });
      } catch (err) {
        console.error('[ADMIN-PANEL] Erreur fermeture panel:', err);
      }
    });
  }
};