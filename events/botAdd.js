
const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');

module.exports = function (client) {
  client.on('guildMemberAdd', async (member) => {
    
    if (!member.user.bot) return;

    const guild = member.guild; 

    try {
      const configAll = await loadAntiRaidConfig();
      const config = configAll[guild.id];
      if (!config || !config.botAdd) return;

      const logConfig = await getLoggingConfig(guild.id);

      let logChannel;
      if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
        logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
      } else {
        logChannel = guild.channels.cache.get(logConfig.logChannelId);
        if (!logChannel || typeof logChannel.send !== 'function') {
          logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
        }
      }

      
      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        console.warn(`[AntiRaid] ⚠️ Permission "View Audit Log" manquante dans ${guild.name}`);
        try {
          await logChannel.send(`⚠️ **Anti-Raid** : Permission "View Audit Log" manquante. Impossible de surveiller l'ajout de bots.`);
        } catch {
          console.log(`[AntiRaid] Permission "View Audit Log" manquante dans ${guild.name}`);
        }
        return;
      }

      let executor;
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.BotAdd,
          limit: 1,
        });
        const entry = logs.entries.first();
        executor = entry?.executor;
        if (!executor) return;
        
        
        if (entry.target?.id !== member.user.id) return;
      } catch (err) {
        if (err.code === 50013) {
          console.warn(`[AntiRaid] ⚠️ Permission "View Audit Log" insuffisante dans ${guild.name}`);
          try {
            await logChannel.send(`⚠️ **Anti-Raid** : Permission "View Audit Log" insuffisante.`);
          } catch {
            console.log(`[AntiRaid] Permission "View Audit Log" insuffisante dans ${guild.name}`);
          }
        } else {
          console.error("[AntiRaid] Erreur récupération logs d'audit :", err);
        }
        return;
      }

      
      const executorMember = guild.members.cache.get(executor.id);
      if (executorMember && executorMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
        try {
          await logChannel.send(`ℹ️ **Anti-Raid** : Bot ${member.user.tag} ajouté par un administrateur (${executor.tag}). Autorisation accordée.`);
        } catch {
          console.log(`[AntiRaid] Bot ${member.user.tag} ajouté par admin ${executor.tag} - autorisé.`);
        }
        return; 
      }

      
      if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        try {
          await logChannel.send(`💡 Je n'ai pas la permission de kick le bot ${member.user.tag}.`);
        } catch {
          console.log(`❌ Pas la permission de kick le bot ${member.user.tag}.`);
        }
        return;
      }

      
      if (member.roles.highest.position >= botMember.roles.highest.position) {
        try {
          await logChannel.send(`❌ Hiérarchie empêche le kick du bot ${member.user.tag}.`);
        } catch {
          console.log(`❌ Hiérarchie empêche le kick du bot ${member.user.tag}.`);
        }
        return;
      }

      try {
        await member.kick('Bot non autorisé (anti-raid)');
        try {
          await logChannel.send(`⚔️ **Anti-Raid** : Le bot ${member.user.tag} a été kick automatiquement (ajouté par ${executor.tag}).`);
        } catch {
          console.log(`🚨 **Anti-Raid** : Le bot ${member.user.tag} a été kick automatiquement (ajouté par ${executor.tag}).`);
        }

        client.emit('antiraidTriggered', guild, {
          reason: 'Bot non autorisé ajouté',
          action: 'Kick automatique du bot',
          suspects: [executor.tag],
          target: member.user.tag,
        });

      } catch (kickErr) {
        if (kickErr.code === 10007) {
          try {
            await logChannel.send(`❌ Impossible de kick le bot ${member.user.tag} : membre introuvable (déjà parti).`);
          } catch {
            console.log(`❌ Bot introuvable (déjà parti) : ${member.user.tag}.`);
          }
        } else {
          console.error('[AntiRaid] Erreur lors du kick :', kickErr);
          try {
            await logChannel.send(`❌ Erreur lors du kick du bot ${member.user.tag} : ${kickErr.message}`);
          } catch {
            console.log(`❌ Erreur lors du kick du bot ${member.user.tag} : ${kickErr.message}`);
          }
        }
      }
    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans botAdd :', err);
    }
  });
};