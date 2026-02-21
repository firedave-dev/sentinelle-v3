const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');
const { isWhitelisted } = require('../core/whitelistManager'); // <--- Import du manager

module.exports = function (client) {
  client.on('guildMemberAdd', async (member) => {
    if (!member.user.bot) return;
    const { guild } = member; 

    try {
      const configAll = client.antiraidConfig || await loadAntiRaidConfig();
      const config = configAll[guild.id];
      if (!config || !config.botAdd) return;

      const logConfig = await getLoggingConfig(guild.id);
      const logChannel = (logConfig?.enabled && logConfig.logChannelId) 
        ? guild.channels.cache.get(logConfig.logChannelId) 
        : null;

      const safeLog = async (messageText) => {
        try {
          if (logChannel && typeof logChannel.send === 'function') await logChannel.send(messageText);
        } catch { console.log(`[AntiRaid] ${messageText.replace(/[*_`]/g, '')}`); }
      };

      const botMember = guild.members.me;
      if (!botMember?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) return;

      let executor;
      try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === member.user.id) executor = entry.executor;
      } catch (err) { return; }

      if (!executor) return;

      // =========================================================================
      // NOUVELLE VÉRIFICATION : WHITELIST AU LIEU DE PERMISSION ADMIN
      // =========================================================================
      const executorIsWhitelisted = await isWhitelisted(guild.id, executor.id);
      const isOwner = executor.id === guild.ownerId; // L'owner est toujours immunisé

      if (executorIsWhitelisted || isOwner) {
        return safeLog(`ℹ️ **Anti-Raid** : Bot \`${member.user.tag}\` ajouté par \`${executor.tag}\` (Utilisateur sur **Liste Blanche**). Autorisation accordée.`);
      }

      if (!member.kickable) {
        return safeLog(`❌ **Anti-Raid** : Je n'ai pas les permissions ou la hiérarchie pour expulser le bot non autorisé \`${member.user.tag}\`.`);
      }

      try {
        await member.kick(`Anti-Raid: Bot non autorisé ajouté par ${executor.tag} (Non Whitelist)`);
        safeLog(`⚔️ **Anti-Raid** : Le bot \`${member.user.tag}\` a été kick automatiquement (ajouté par \`${executor.tag}\`).`);

        client.emit('antiraidTriggered', guild, {
          reason: 'Bot non autorisé ajouté par un utilisateur non-whitelist',
          action: 'Kick automatique du bot',
          suspects: [executor.tag],
          target: member.user.tag,
        });

      } catch (kickErr) {
        if (kickErr.code !== 10007) safeLog(`❌ Erreur lors du kick du bot \`${member.user.tag}\` : ${kickErr.message}`);
      }

    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans botAdd :', err);
    }
  });
};