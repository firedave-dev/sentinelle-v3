const { Events } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage'); 

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    
    client.antiraidConfig = loadAntiRaidConfig();
    client.raidTracking = {}; 

    console.log('Configuration Anti-Raid restaurée.');
  },
};

