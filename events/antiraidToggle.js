module.exports = {
  name: 'antiraidToggle',

  /**
   * @param {import('discord.js').Guild} guild
   * @param {boolean} isEnabled
   * @param {import('discord.js').Client} client
   */
  async execute(guild, isEnabled, client) {
    if (!guild || !client) return;

    
    const logChannel = guild.channels.cache.find(
      c =>
        c.name === 'logs' &&
        c.type === 0 && 
        c.topic === 'Salon de logs automatique créé par Sentinelle 🛡️'
    );

    if (!logChannel || !logChannel.isTextBased()) return;

    const statusMsg = isEnabled
      ? '🛡️ Le mode **anti-raid** a été activé sur ce serveur.'
      : '❌ Le mode **anti-raid** a été désactivé sur ce serveur.';

    try {
      await logChannel.send({
        content: statusMsg,
      });
    } catch (err) {
      console.error(`❌ Erreur lors de l'envoi du message anti-raid toggle dans ${guild.name} :`, err);
    }
  }
};