const { Events } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const logAntiraid = require('../logs/logAntiraid');

const pingCounts = new Map();
const MAX_PINGS = 5; 
const TIME_WINDOW = 10_000; 
const MUTE_DURATION = 10 * 60 * 1000; 

module.exports = client => {
  client.on(Events.MessageCreate, async message => {
    
    if (message.author.bot || !message.guild) return;

    const guild = message.guild;

    
    let config;
    try {
      config = await loadAntiRaidConfig();
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration anti-raid :', error);
      return;
    }

    const guildConfig = config[guild.id];
    if (!guildConfig?.enabled) return;

    const mentionCount = message.mentions.users.size + message.mentions.roles.size;

    if (mentionCount > MAX_PINGS) {
      const key = `${guild.id}-${message.author.id}`;
      const now = Date.now();
      const data = pingCounts.get(key) || { count: 0, first: now };

      if (now - data.first < TIME_WINDOW) {
        data.count++;
      } else {
        data.count = 1;
        data.first = now;
      }

      pingCounts.set(key, data);

      if (data.count >= MAX_PINGS) {
        let actionTaken = 'Aucune action (permissions insuffisantes ou membre introuvable)';

        try {
          const member = await guild.members.fetch(message.author.id);
          if (member && member.moderatable) {
            await member.timeout(MUTE_DURATION, 'Ping massif détecté');
            actionTaken = 'Timeout de 10 minutes';
          }
        } catch (error) {
          console.error(`Erreur lors du timeout de ${message.author.tag} :`, error);
        }

        
        try {
          await logAntiraid(guild, client, `⚠️ **${message.author.tag}** a mentionné **${mentionCount} personnes** dans un message.\n**Action prise :** ${actionTaken}`);
        } catch (logError) {
          console.error('Erreur lors de la journalisation anti-raid :', logError);
        }

        
        client.emit('antiraidTriggered', guild, {
          reason: `Ping massif par ${message.author.tag}`,
          action: actionTaken,
          suspects: [message.author.tag],
        });

        
        pingCounts.delete(key);
      }
    }
  });
};
