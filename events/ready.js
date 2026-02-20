// events/ready.js
const { Events } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const getLogChannel = require('../logs/getLogChannel');

function updateStatusLoop(client) {
  let index = 0;

  setInterval(() => {
    const totalGuilds = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);

    const statuses = [
      { name: `${totalGuilds} serveurs` },
      { name: `${totalMembers.toLocaleString()} utilisateurs` },
      { name: 'Version 1.5' }
    ];

    client.user.setPresence({
      activities: [{ name: statuses[index].name, type: 1, url: "https://twitch.tv/Minat0dragon" }],
      status: 'online'
    });

    index = (index + 1) % statuses.length;
  }, 15000); 
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`🤖 Le bot est prêt ! Connecté en tant que ${client.user.tag}`);

    client.antiraidConfig = await loadAntiRaidConfig();
    client.raidTracking = {}; 
    console.log('✅ Configuration Anti-Raid restaurée.');

    updateStatusLoop(client);

    for (const [guildId, guildConfig] of Object.entries(client.antiraidConfig)) {
      const state = guildConfig.enabled ? 'activé ✅' : 'désactivé ❌';
      console.log(`ℹ️ Serveur ${guildId}: Anti-raid est **${state}**`);
    }

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const logChannel = await getLogChannel(guild, client);
        if (logChannel) console.log(`📋 Salon de logs prêt ou existant dans ${guild.name}`);
      } catch (error) {
        console.error(`❌ Erreur logChannel dans ${guild.name} :`, error.message);
      }
    }
  },
};