const { PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');

const userCooldowns = new Map();  
const COOLDOWN_MS = 30 * 1000;    

module.exports = function (client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    const guild = message.guild;
    try {
      const configAll = await loadAntiRaidConfig();
      const config = configAll[guild.id];
      if (!config || !config.messageCreate) return;

      // ====== Gestion du canal de logs ======
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

      // ====== Détection des liens d'invitations ======
      const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+/gi;
      const matches = message.content.match(inviteRegex);
      if (!matches || matches.length === 0) return;

      let member;
      try {
        member = await guild.members.fetch(message.author.id);
      } catch {
        return;
      }

      if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

      const botMember = guild.members.me;

      // ====== Cooldown ======
      const key = `${guild.id}-${member.id}`;
      const cooldownUntil = userCooldowns.get(key) || 0;
      if (Date.now() < cooldownUntil) {
        console.log(`⏳ Cooldown actif pour ${member.user.tag}`);
        return;
      }

      // ====== Suppression du message ======
      try {
        if (botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.delete().catch(err => {
            if (err.code === 10008) {
              console.warn("⚠️ Message déjà supprimé, rien à faire.");
            } else {
              throw err;
            }
          });
          console.log('✅ Message supprimé');
        } else {
          await logChannel.send(`❌ Je n'ai pas la permission de supprimer les messages.`);
        }
      } catch (err) {
        console.error('❌ Erreur lors de la suppression du message:', err);
        await logChannel.send(`❌ Erreur lors de la suppression du message de ${member.user.tag}: ${err.message}`);
      }

      // ====== Timeout de l’utilisateur ======
      try {
        if (
          botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers) &&
          member.roles.highest.position < botMember.roles.highest.position
        ) {
          await member.timeout(3 * 60 * 60 * 1000, 'Anti-lien: timeout automatique pour invitation Discord');
          await logChannel.send(`⌛ ${member.user.tag} a été timeout pendant 3h pour avoir posté un lien d'invitation Discord.`);
          console.log(`✅ ${member.user.tag} timeout appliqué`);
        } else if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          await logChannel.send(`❌ Je n'ai pas la permission de timeout les membres.`);
        } else {
          await logChannel.send(`❌ Impossible de timeout ${member.user.tag} à cause de la hiérarchie des rôles.`);
        }
      } catch (err) {
        console.error('❌ Erreur lors du timeout:', err);
        await logChannel.send(`❌ Erreur lors du timeout de ${member.user.tag}: ${err.message}`);
      }

      // ====== MP à l’utilisateur ======
      try {
        await member.send('🔗 Les invitations Discord sont interdites sur ce serveur. Ton message a été supprimé et tu as été timeout.');
      } catch {
        console.log('❌ Impossible d\'envoyer un MP à l\'utilisateur');
      }

      // ====== Application du cooldown ======
      userCooldowns.set(key, Date.now() + COOLDOWN_MS);

      // ====== Event custom ======
      client.emit('antiraidTriggered', guild, {
        reason: 'Lien Discord détecté',
        action: 'Suppression de message / Timeout',
        suspects: [member.user.tag],
      });
    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans messageCreate :', err);
    }
  });
};
