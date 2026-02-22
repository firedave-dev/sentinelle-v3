require('events').defaultMaxListeners = 30;
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { loadAntiRaidConfig } = require('./core/antiraidStorage');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,             
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User]
});

client.commands = new Collection();
client.antiraidConfig = loadAntiRaidConfig();
client.raidTracking = {};

client.reloadAntiRaidConfig = () => {
  client.antiraidConfig = loadAntiRaidConfig();
};

// --- Chargement des Commandes
function loadCommandsRecursively(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`📁 Dossier '${dir}' non trouvé. Aucune commande chargée.`);
    return;
  }
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadCommandsRecursively(filePath);
    } else if (file.endsWith('.js')) {
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`[AVERTISSEMENT] La commande dans ${filePath} est invalide.`);
      }
    }
  }
}
loadCommandsRecursively(path.join(__dirname, 'commands'));

// --- Chargement des Événements
const eventsDir = path.join(__dirname, 'events');
if (fs.existsSync(eventsDir)) {
  fs.readdirSync(eventsDir).forEach(file => {
    if (!file.endsWith('.js')) return;
    const event = require(`./events/${file}`);
    
    if (event.name && event.execute) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    } else if (typeof event === 'function') {

      event(client);
    }
  });
}

// Chargement des modules externes
require('./logs/channelLogs')(client);
require('./logs/antiraidTriggered')(client);

module.exports = client;
client.login(process.env.TOKEN);