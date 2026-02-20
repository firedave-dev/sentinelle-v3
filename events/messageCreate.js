const { Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');

const userCooldowns = new Map();  
const COOLDOWN_MS = 30 * 1000;    

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const botMentioned = message.mentions.has(client.user);
    if (botMentioned && !message.mentions.everyone && message.mentions.roles.size === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`ℹ️ ${message.author.tag} Tu m'as mentionné ?`)
        .setDescription("Voici quelques options utiles :\n\n> 🏠 Utilise `/help` pour voir mes commandes\n> 🤖 Besoin d'aide ? Rejoins notre [serveur support](https://discord.gg/crQ9Qgzbck)")
        .setColor('Blurple')
        // .setFooter({ text: `Mentionné par ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await message.reply({ embeds: [embed] }).catch(() => {});
    }

    try {
      const configAll = client.antiraidConfig || await loadAntiRaidConfig();
      const config = configAll[message.guild.id];
      if (!config || !config.messageCreate) return;

      const logConfig = await getLoggingConfig(message.guild.id);
      let logChannel;
      if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
        logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
      } else {
        logChannel = message.guild.channels.cache.get(logConfig.logChannelId);
        if (!logChannel || typeof logChannel.send !== 'function') {
          logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
        }
      }

      const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+/gi;
      const matches = message.content.match(inviteRegex);
      if (!matches || matches.length === 0) return;

      let member;
      try {
        member = await message.guild.members.fetch(message.author.id);
      } catch {
        return;
      }

      if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

      const botMember = message.guild.members.me;
      const key = `${message.guild.id}-${member.id}`;
      const cooldownUntil = userCooldowns.get(key) || 0;

      if (Date.now() < cooldownUntil) return;

      if (botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        await message.delete().catch(err => {
          if (err.code !== 10008) console.error(err);
        });
      }

      if (botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers) && member.roles.highest.position < botMember.roles.highest.position) {
        await member.timeout(1 * 60 * 60 * 1000, 'Anti-lien: timeout automatique');
        await logChannel.send(`⌛ ${member.user.tag} a été timeout (1h) pour un lien d'invitation.`);
      }

      member.send('🔗 Les invitations Discord sont interdites sur ce serveur. Message supprimé et timeout appliqué.').catch(() => {});
      userCooldowns.set(key, Date.now() + COOLDOWN_MS);

      client.emit('antiraidTriggered', message.guild, {
        reason: 'Lien Discord détecté',
        action: 'Suppression de message / Timeout',
        suspects: [member.user.tag],
      });
    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans messageCreate :', err);
    }
  }
};