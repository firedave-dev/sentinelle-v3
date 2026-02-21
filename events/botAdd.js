const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');

module.exports = function (client) {
  client.on('guildMemberAdd', async (member) => {
    // On ne réagit que si le nouveau membre est un bot
    if (!member.user.bot) return;

    const { guild } = member; 

    try {
      // Chargement des configurations
      const configAll = client.antiraidConfig || await loadAntiRaidConfig();
      const config = configAll[guild.id];
      if (!config || !config.botAdd) return;

      const logConfig = await getLoggingConfig(guild.id);
      const logChannel = (logConfig?.enabled && logConfig.logChannelId) 
        ? guild.channels.cache.get(logConfig.logChannelId) 
        : null;

      // Fonction utilitaire pour éviter de répéter les try/catch à chaque log
      const safeLog = async (messageText, consoleFallback) => {
        try {
          if (logChannel && typeof logChannel.send === 'function') {
            await logChannel.send(messageText);
          } else {
            console.log(`[AntiRaid] ${consoleFallback || messageText.replace(/[*_`]/g, '')}`);
          }
        } catch {
          console.log(`[AntiRaid] ${consoleFallback || messageText.replace(/[*_`]/g, '')}`);
        }
      };

      const botMember = guild.members.me;
      if (!botMember) return;

      // 1. Vérification de la permission de lire les logs d'audit
      if (!botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        return safeLog(
          `⚠️ **Anti-Raid** : Permission "Voir les logs d'audit" manquante dans \`${guild.name}\`. Impossible de surveiller l'ajout de bots.`,
          `Permission View Audit Log manquante dans ${guild.name}`
        );
      }

      // 2. Recherche de l'auteur de l'ajout via les logs d'audit
      let executor;
      try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 });
        const entry = logs.entries.first();
        
        // On s'assure que le log correspond bien au bot qui vient de rejoindre
        if (entry && entry.target?.id === member.user.id) {
          executor = entry.executor;
        }
      } catch (err) {
        if (err.code === 50013) {
          return safeLog(`⚠️ **Anti-Raid** : Permission "Voir les logs d'audit" insuffisante dans \`${guild.name}\`.`);
        }
        console.error("[AntiRaid] Erreur récupération logs d'audit :", err);
        return;
      }

      if (!executor) return; // Si on ne trouve pas qui a ajouté le bot, on s'arrête.

      // 3. Vérification si l'auteur est Administrateur (Fetch pour être sûr à 100% de l'avoir)
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (executorMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return safeLog(`ℹ️ **Anti-Raid** : Bot \`${member.user.tag}\` ajouté par l'administrateur \`${executor.tag}\`. Autorisation accordée.`);
      }

      // 4. Vérification native de Discord.js : le bot a-t-il le droit et la hiérarchie pour expulser ?
      if (!member.kickable) {
        return safeLog(`❌ **Anti-Raid** : Je n'ai pas les permissions ou la hiérarchie pour expulser le bot \`${member.user.tag}\`.`);
      }

      // 5. Expulsion du bot non autorisé
      try {
        await member.kick(`Anti-Raid: Bot non autorisé ajouté par ${executor.tag}`);
        
        safeLog(`⚔️ **Anti-Raid** : Le bot \`${member.user.tag}\` a été kick automatiquement (ajouté par \`${executor.tag}\`).`);

        client.emit('antiraidTriggered', guild, {
          reason: 'Bot non autorisé ajouté',
          action: 'Kick automatique du bot',
          suspects: [executor.tag],
          target: member.user.tag,
        });

      } catch (kickErr) {
        if (kickErr.code === 10007) {
          safeLog(`❌ Impossible de kick le bot \`${member.user.tag}\` : membre introuvable (déjà parti ou kické par un autre bot).`);
        } else {
          console.error('[AntiRaid] Erreur lors du kick :', kickErr);
          safeLog(`❌ Erreur lors du kick du bot \`${member.user.tag}\` : ${kickErr.message}`);
        }
      }

    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans l\'événement botAdd :', err);
    }
  });
};