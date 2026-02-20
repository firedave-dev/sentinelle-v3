const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType, Collection } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scanserveur')
    .setDescription('Scanne le serveur pour détecter des anomalies et risques de sécurité.'),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Cette commande est réservée aux administrateurs.', ephemeral: true });
    }

    const guild = interaction.guild;
    
    const getServerCategory = (memberCount) => {
      if (memberCount <= 50) return { name: 'Micro-communauté', tier: 1, emoji: '🔹' };
      if (memberCount <= 100) return { name: 'Petite communauté', tier: 2, emoji: '🔸' };
      if (memberCount <= 500) return { name: 'Communauté moyenne', tier: 3, emoji: '🟡' };
      if (memberCount <= 1000) return { name: 'Grande communauté', tier: 4, emoji: '🟠' };
      if (memberCount <= 5000) return { name: 'Serveur majeur', tier: 5, emoji: '🔴' };
      if (memberCount <= 10000) return { name: 'Serveur d\'envergure', tier: 6, emoji: '🟣' };
      return { name: 'Serveur d\'échelle massive', tier: 7, emoji: '⚫' };
    };

    const serverCategory = getServerCategory(guild.memberCount);
    
    await interaction.reply({ 
      content: `🔍 Démarrage du scan de sécurité...\n📊 Catégorie : **${serverCategory.name}** (${guild.memberCount} membres)\n[░░░░░░░░] 0%`,
      fetchReply: true 
    });

    const context = { serverCategory };

    const steps = [
      {
        label: 'Récupération des membres...',
        action: async () => {
          try {
            if (guild.memberCount <= 1000) {
              context.members = await guild.members.fetch();
            } else if (guild.memberCount <= 5000) {
              try {
                context.members = await guild.members.fetch();
              } catch {
                context.members = guild.members.cache;
              }
            } else {
              context.members = guild.members.cache;
            }
          } catch (err) {
            context.members = guild.members.cache;
          }
        }
      },
      {
        label: 'Analyse des rôles à permissions critiques...',
        action: async () => {
          const perms = [
            'Administrator', 'BanMembers', 'KickMembers',
            'ManageGuild', 'ManageRoles', 'ManageChannels',
            'ManageWebhooks', 'MentionEveryone'
          ];
          context.criticalRoles = guild.roles.cache.filter(r =>
            !r.managed && perms.some(p => r.permissions.has(PermissionsBitField.Flags[p]))
          );
        }
      },
      {
        label: 'Détection des bots avec permissions admin...',
        action: async () => {
          context.adminBots = context.members.filter(m =>
            m.user.bot && m.permissions.has(PermissionsBitField.Flags.Administrator)
          );
        }
      },
      {
        label: 'Détection des comptes récents (< 7j)...',
        action: async () => {
          const now = Date.now();
          context.recentAccounts = context.members.filter(m =>
            !m.user.bot && now - m.user.createdTimestamp < 7 * 24 * 60 * 60 * 1000
          );
        }
      },
      {
        label: 'Détection des comptes sans avatar...',
        action: async () => {
          context.noAvatarUsers = context.members.filter(m =>
            !m.user.bot && !m.user.avatar
          );
        }
      },
      {
        label: 'Détection des membres anciens (> 90j)...',
        action: async () => {
          const now = Date.now();
          context.oldMembers = context.members.filter(m =>
            !m.user.bot && m.joinedAt && now - m.joinedAt.getTime() > 90 * 24 * 60 * 60 * 1000
          );
        }
      },
      {
        label: 'Analyse des webhooks...',
        action: async () => {
          const channels = guild.channels.cache.filter(c =>
            [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)
          );
          let collected = [];
          for (const ch of channels.values()) {
            try {
              const whs = await ch.fetchWebhooks();
              collected.push(...whs.values());
            } catch {
              continue;
            }
          }
          context.webhooks = new Collection(collected.map(w => [w.id, w]));
        }
      },
      {
        label: 'Chargement des données IA Anti-Raid...',
        action: async () => {
          try {
            const aiPath = path.join(__dirname, '../../data/IA.json');
            const data = await fs.readFile(aiPath, 'utf8');
            const aiData = JSON.parse(data);
            
            context.aiProfile = aiData.intelligentSystem?.guildProfiles?.[guild.id] || null;
            context.aiMetrics = aiData.metrics || { totalAlerts: 0, confirmedThreats: 0, falsePositives: 0 };
          } catch (err) {
            context.aiProfile = null;
            context.aiMetrics = { totalAlerts: 0, confirmedThreats: 0, falsePositives: 0 };
          }
        }
      }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const filled = '█'.repeat(i + 1).padEnd(8, '░');
      const percent = Math.round(((i + 1) / steps.length) * 100);

      try {
        await interaction.editReply(`🔍 ${step.label}\n📊 Catégorie : **${serverCategory.name}** (${guild.memberCount} membres)\n[${filled}] ${percent}%`);
      } catch (err) {
        console.warn("Impossible de modifier le message de progression");
      }

      try {
        await step.action();
      } catch (err) {
        console.error(`Erreur dans l'étape: ${step.label}`, err);
      }
    }

    const totalMembers = guild.memberCount;
    const humanUsers = context.members.filter(m => !m.user.bot).size;
    const bots = context.members.filter(m => m.user.bot).size;
    const vocaux = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const textuels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const forums = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    let danger = 0;

    const getAdaptiveThresholds = (tier, memberCount) => {
      switch(tier) {
        case 1:
          return {
            criticalRoles: 3,
            adminBots: 1,
            recentAccounts: Math.max(3, Math.floor(memberCount * 0.10)),
            webhooks: 2,
            oldMembers: Math.floor(memberCount * 0.30)
          };
        case 2:
          return {
            criticalRoles: 4,
            adminBots: 1,
            recentAccounts: Math.floor(memberCount * 0.08),
            webhooks: 3,
            oldMembers: Math.floor(memberCount * 0.35)
          };
        case 3:
          return {
            criticalRoles: 6,
            adminBots: 2,
            recentAccounts: Math.floor(memberCount * 0.06),
            webhooks: 5,
            oldMembers: Math.floor(memberCount * 0.40)
          };
        case 4:
          return {
            criticalRoles: 8,
            adminBots: 2,
            recentAccounts: Math.floor(memberCount * 0.05),
            webhooks: 8,
            oldMembers: Math.floor(memberCount * 0.45)
          };
        case 5:
          return {
            criticalRoles: 12,
            adminBots: 3,
            recentAccounts: Math.floor(memberCount * 0.04),
            webhooks: 15,
            oldMembers: Math.floor(memberCount * 0.50)
          };
        case 6:
          return {
            criticalRoles: 18,
            adminBots: 4,
            recentAccounts: Math.floor(memberCount * 0.03),
            webhooks: 25,
            oldMembers: Math.floor(memberCount * 0.55)
          };
        case 7:
          return {
            criticalRoles: 25,
            adminBots: 5,
            recentAccounts: Math.floor(memberCount * 0.02),
            webhooks: 40,
            oldMembers: Math.floor(memberCount * 0.60)
          };
        default:
          return {
            criticalRoles: 5,
            adminBots: 1,
            recentAccounts: Math.floor(memberCount * 0.05),
            webhooks: 5,
            oldMembers: Math.floor(memberCount * 0.40)
          };
      }
    };

    const seuils = getAdaptiveThresholds(serverCategory.tier, totalMembers);

    if (context.criticalRoles.size > seuils.criticalRoles) danger++;
    if (context.adminBots.size > seuils.adminBots) danger++;
    if (context.recentAccounts.size > seuils.recentAccounts) danger++;
    if (context.webhooks.size > seuils.webhooks) danger++;
    if (context.oldMembers.size > seuils.oldMembers) danger++;

    if (context.aiProfile && context.aiProfile.raidHistory > 5) {
      danger++;
    }

    const getSecurityStatus = (danger) => {
      if (danger >= 5) return { emoji: '🔴', text: 'CRITIQUE', color: 0xFF4444 };
      if (danger >= 4) return { emoji: '🟠', text: 'ÉLEVÉ', color: 0xFF8800 };
      if (danger >= 3) return { emoji: '🟡', text: 'MODÉRÉ', color: 0xFFCC00 };
      if (danger >= 2) return { emoji: '🔵', text: 'FAIBLE', color: 0x4488FF };
      return { emoji: '🟢', text: 'SÉCURISÉ', color: 0x44FF88 };
    };

    const security = getSecurityStatus(danger);

    const generateContent = (section) => {
      const getSecurityBar = (danger) => {
        const maxDanger = 6;
        const securityLevel = maxDanger - danger;
        const greenBlocks = '🟩'.repeat(Math.max(0, securityLevel));
        const redBlocks = '🟥'.repeat(danger);
        const percentage = Math.round((securityLevel / maxDanger) * 100);
        return `${greenBlocks}${redBlocks} **${percentage}%**`;
      };

      let content = `# 🛡️ Rapport de Sécurité • ${guild.name}\n\n`;

      switch(section) {
        case 'accueil':
          content += `┌─────────────────────────────────────┐\n`;
          content += `│  **NIVEAU : ${security.emoji} ${security.text}**  │\n`;
          content += `└─────────────────────────────────────┘\n\n`;
          content += `**Indicateur de sécurité :**\n${getSecurityBar(danger)}\n\n`;
          content += `## 📊 Vue d'ensemble\n`;
          content += `${serverCategory.emoji} **Catégorie :** \`${serverCategory.name}\`\n`;
          content += `👥 **Membres :** \`${totalMembers.toLocaleString()}\` (${humanUsers} users, ${bots} bots)\n`;
          content += `🛡️ **Rôles critiques :** \`${context.criticalRoles.size}\`\n`;
          content += `🔗 **Webhooks :** \`${context.webhooks.size}\`\n`;
          content += `⚠️ **Risques détectés :** \`${danger}/6\`\n\n`;
          content += `📋 *Utilisez le menu ci-dessous pour explorer les détails*`;
          break;

        case 'securite':
          content += `## 🔒 Analyse de Sécurité\n\n`;
          content += `**Catégorie :** ${serverCategory.emoji} \`${serverCategory.name}\`\n`;
          content += `**Seuils adaptatifs appliqués**\n\n`;
          
          const advices = [];
          if (context.criticalRoles.size > seuils.criticalRoles) {
            advices.push('🔴 **Permissions critiques** : Trop de rôles disposent de permissions dangereuses');
          }
          if (context.adminBots.size > seuils.adminBots) {
            advices.push('🤖 **Bots administrateurs** : Surveillez les bots ayant des permissions admin');
          }
          if (context.webhooks.size > seuils.webhooks) {
            advices.push('🔗 **Webhooks** : Vérifiez la légitimité des webhooks actifs');
          }
          if (context.aiProfile && context.aiProfile.raidHistory > 5) {
            advices.push('🚨 **Historique de raids** : Serveur ciblé par des attaques');
          }

          content += advices.length > 0 ? advices.join('\n\n') + '\n\n' : '✅ Aucun risque majeur détecté !\n\n';

          content += `### 📊 Statistiques détaillées\n`;
          content += `🛡️ **Rôles à permissions critiques :** \`${context.criticalRoles.size}\` / \`${seuils.criticalRoles}\`\n`;
          content += `🤖 **Bots administrateurs :** \`${context.adminBots.size}\` / \`${seuils.adminBots}\`\n`;
          content += `🔗 **Webhooks actifs :** \`${context.webhooks.size}\` / \`${seuils.webhooks}\`\n`;
          content += `🆕 **Comptes récents :** \`${context.recentAccounts.size}\` / \`${seuils.recentAccounts}\`\n`;
          content += `💤 **Membres anciens :** \`${context.oldMembers.size}\` / \`${seuils.oldMembers}\`\n\n`;

          if (context.criticalRoles.size > 0) {
            content += `### ⚠️ Rôles critiques\n`;
            const rolesList = context.criticalRoles
              .map(r => `• \`${r.name}\` (${r.members.size} membres)`)
              .slice(0, 10)
              .join('\n');
            const more = context.criticalRoles.size > 10 ? `\n*+${context.criticalRoles.size - 10} autres...*` : '';
            content += rolesList + more;
          }
          break;

        case 'membres':
          content += `## 👥 Analyse des Membres\n\n`;
          content += `### 📊 Statistiques générales\n`;
          content += `**Total :** \`${totalMembers.toLocaleString()}\`\n`;
          content += `👤 **Humains :** \`${humanUsers.toLocaleString()}\`\n`;
          content += `🤖 **Bots :** \`${bots}\`\n`;
          content += `${serverCategory.emoji} **Catégorie :** \`${serverCategory.name}\`\n\n`;

          content += `### 🆕 Comptes récents (< 7j)\n`;
          content += `**Total :** \`${context.recentAccounts.size}\` / \`${seuils.recentAccounts}\`\n`;
          content += `**Statut :** ${context.recentAccounts.size > seuils.recentAccounts ? '⚠️ Élevé' : '✅ Normal'}\n\n`;

          content += `### 🖼️ Comptes sans avatar\n`;
          content += `**Total :** \`${context.noAvatarUsers.size}\`\n`;
          content += `**Pourcentage :** \`${Math.round((context.noAvatarUsers.size / Math.max(humanUsers, 1)) * 100)}%\`\n\n`;

          content += `### 💤 Membres anciens (> 90j)\n`;
          content += `**Total :** \`${context.oldMembers.size}\` / \`${seuils.oldMembers}\`\n`;
          content += `**Statut :** ${context.oldMembers.size > seuils.oldMembers ? '⚠️ Nettoyage recommandé' : '✅ Acceptable'}\n\n`;

          if (context.recentAccounts.size > 0) {
            content += `### 🆕 Nouveaux comptes\n`;
            const recentList = context.recentAccounts
              .map(m => {
                const age = Math.floor((Date.now() - m.user.createdTimestamp) / (24 * 60 * 60 * 1000));
                return `• ${m.user.tag} (${age}j)`;
              })
              .slice(0, 8)
              .join('\n');
            const more = context.recentAccounts.size > 8 ? `\n*+${context.recentAccounts.size - 8} autres...*` : '';
            content += recentList + more;
          }
          break;

        case 'ia':
          const aiActive = context.aiProfile !== null;
          
          content += `## 🤖 Analyse IA Anti-Raid\n\n`;
          content += aiActive 
            ? '✅ **Système IA actif** sur ce serveur\nL\'intelligence artificielle surveille en temps réel les tentatives de raids.\n\n'
            : '⚠️ **Aucune donnée IA** pour ce serveur\nLe système n\'a pas encore collecté de données d\'apprentissage.\n\n';

          if (aiActive) {
            const profile = context.aiProfile;
            const total = profile.raidHistory + profile.falseAlerts;
            const accuracy = total > 0 ? Math.round((profile.raidHistory / total) * 100) : 100;

            content += `### 📊 Profil du serveur\n`;
            content += `🚨 **Raids détectés :** \`${profile.raidHistory}\`\n`;
            content += `✅ **Faux positifs :** \`${profile.falseAlerts}\`\n`;
            content += `🎯 **Précision IA :** \`${accuracy}%\`\n`;
            content += `⚖️ **Seuil adaptatif :** \`${Math.round(profile.adaptiveThreshold * 100)}%\`\n\n`;

            content += `### 🌐 Métriques globales\n`;
            content += `📈 **Analyses totales :** \`${context.aiMetrics.totalAnalyses || 0}\`\n`;
            content += `🚨 **Alertes émises :** \`${context.aiMetrics.totalAlerts || 0}\`\n`;
            content += `✅ **Menaces confirmées :** \`${context.aiMetrics.confirmedThreats || 0}\`\n\n`;

            const aiStatus = profile.raidHistory === 0 
              ? '🟢 **Aucun raid détecté** - Serveur sain'
              : profile.raidHistory < 5
              ? '🟡 **Raids occasionnels** - Surveillance normale'
              : '🔴 **Serveur ciblé** - Surveillance renforcée';

            content += `### 🛡️ État de protection\n${aiStatus}\n\n`;

            if (profile.raidHistory > 0) {
              const lastUpdate = new Date(profile.lastUpdate);
              content += `⏰ **Dernière mise à jour :** <t:${Math.floor(lastUpdate.getTime() / 1000)}:R>`;
            }
          } else {
            content += `### 💡 Comment activer l'IA ?\n`;
            content += `1. Utilisez \`/antiraid config\` pour activer le système\n`;
            content += `2. L'IA apprendra automatiquement des événements du serveur\n`;
            content += `3. Le seuil de détection s'adaptera aux habitudes de votre serveur`;
          }
          break;

        case 'infrastructure':
          content += `## 📂 Infrastructure du Serveur\n\n`;
          content += `### 📊 Salons\n`;
          content += `💬 **Salons texte :** \`${textuels}\`\n`;
          content += `🔊 **Salons vocaux :** \`${vocaux}\`\n`;
          content += `📋 **Forums :** \`${forums}\`\n`;
          content += `📁 **Catégories :** \`${categories}\`\n\n`;

          content += `### 🎭 Rôles\n`;
          content += `**Total :** \`${guild.roles.cache.size}\`\n`;
          content += `🛡️ **Critiques :** \`${context.criticalRoles.size}\`\n`;
          content += `🤖 **Gérés par bots :** \`${guild.roles.cache.filter(r => r.managed).size}\`\n\n`;

          content += `### 📅 Informations\n`;
          content += `**Création :** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>\n`;
          content += `**Propriétaire :** <@${guild.ownerId}>\n`;
          content += `**Niveau boost :** ${guild.premiumTier || 0} (${guild.premiumSubscriptionCount || 0} boosts)\n`;
          content += `${serverCategory.emoji} **Catégorie :** \`${serverCategory.name}\`\n\n`;

          if (context.webhooks.size > 0) {
            content += `### 🔗 Webhooks actifs\n`;
            const webhooksList = context.webhooks
              .map(w => `• \`${w.name}\` dans <#${w.channelId}>`)
              .slice(0, 8)
              .join('\n');
            const more = context.webhooks.size > 8 ? `\n*+${context.webhooks.size - 8} autres...*` : '';
            content += webhooksList + more;
          }
          break;
      }

      content += `\n\n*🔍 Scan par ${interaction.user.tag} • ${new Date().toLocaleDateString('fr-FR')}*`;
      return content;
    };

    const row = {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `scan_menu_${interaction.user.id}`,
          placeholder: "📊 Sélectionner une section...",
          options: [
            {
              label: "Accueil",
              value: "accueil",
              description: "Vue d'ensemble du rapport",
              emoji: { name: "🏠" }
            },
            {
              label: "Sécurité",
              value: "securite",
              description: "Analyse des risques et permissions",
              emoji: { name: "🔒" }
            },
            {
              label: "Membres",
              value: "membres",
              description: "Statistiques des utilisateurs",
              emoji: { name: "👥" }
            },
            {
              label: "IA Anti-Raid",
              value: "ia",
              description: "Analyse intelligente des menaces",
              emoji: { name: "🤖" }
            },
            {
              label: "Infrastructure",
              value: "infrastructure",
              description: "Structure du serveur",
              emoji: { name: "📂" }
            }
          ]
        }
      ]
    };

    await interaction.editReply({
      content: '',
      flags: 32768,
      components: [
        {
          type: 17,
          accent_color: security.color,
          components: [
            {
              type: 10,
              content: generateContent('accueil')
            },
            {
              type: 14,
              spacing: 1
            },
            row
          ]
        }
      ]
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === `scan_menu_${interaction.user.id}` && i.user.id === interaction.user.id,
      time: 300000
    });

    collector.on('collect', async i => {
      const section = i.values[0];
      
      await i.update({
        flags: 32768,
        components: [
          {
            type: 17,
            accent_color: security.color,
            components: [
              {
                type: 10,
                content: generateContent(section)
              },
              {
                type: 14,
                spacing: 1
              },
              row
            ]
          }
        ]
      });
    });

    collector.on('end', () => {
      row.components[0].disabled = true;
      
      interaction.editReply({
        flags: 32768,
        components: [
          {
            type: 17,
            accent_color: 0x888888,
            components: [
              {
                type: 10,
                content: `# ⏰ Session expirée\n\nRelancez la commande \`/scanserveur\` pour un nouveau scan.`
              },
              {
                type: 14,
                spacing: 1
              },
              row
            ]
          }
        ]
      }).catch(() => {});
    });
  }
};