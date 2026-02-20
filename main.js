require('events').defaultMaxListeners = 30;
const { Client, GatewayIntentBits, Partials, Collection, ChannelType, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const getLogChannel = require('./logs/getLogChannel');
const { loadAntiRaidConfig } = require('./core/antiraidStorage');
const interactionCreate1Handler = require('./events/interactionCreate1.js');

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

client.setMaxListeners(30);

const eventsDir = path.join(__dirname, 'events');
fs.readdirSync(eventsDir).forEach(file => {
  const eventHandler = require(`./events/${file}`);
  if (typeof eventHandler === 'function') {
    eventHandler(client); 
  }
});

client.commands = new Collection();
client.antiraidConfig = loadAntiRaidConfig();
client.raidTracking = {};
module.exports = client;

let kickedGuilds = new Set();

function isBotInGuild(guildId) {
  return !kickedGuilds.has(guildId);
}

client.reloadAntiRaidConfig = () => {
  client.antiraidConfig = loadAntiRaidConfig();
};


function loadCommandsRecursively(dir) {
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


const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  loadCommandsRecursively(commandsPath);
} else {
  console.warn("📁 Dossier 'commands' non trouvé. Aucune commande chargée.");
}


require('./logs/channelLogs')(client);
require('./logs/roleLogs')(client);
require('./logs/antiraidTriggered')(client);


require('./events/guildMemberAdd')(client);

function updateStatusLoop() {
  let index = 0;

  setInterval(() => {
    const totalGuilds = client.guilds.cache.size;

    
    const totalMembers = client.guilds.cache.reduce((acc, guild) => {
      return acc + (guild.memberCount || 0); 
    }, 0);

    
    const statuses = [
      { name: `${totalGuilds} serveurs` },
      { name: `${totalMembers.toLocaleString()} utilisateurs` },
      { name: 'Version 1.0.5' }
    ];

    
    client.user.setPresence({
      activities: [{
        name: statuses[index].name,
        type: 1,
        url: "https://twitch.tv/tonstream"
      }],
      status: 'online'
    });

    index = (index + 1) % statuses.length;
  }, 5000);
}


client.once('ready', async () => {
  console.log(`🤖 Le bot est prêt ! Connecté en tant que ${client.user.tag}`);
  updateStatusLoop();

  
  const config = await loadAntiRaidConfig();

  
  for (const [guildId, guildConfig] of Object.entries(config)) {
    const state = guildConfig.enabled ? 'activé ✅' : 'désactivé ❌';
    console.log(`ℹ️ Serveur ${guildId}: Anti-raid est **${state}**`);
  }

  
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const logChannel = await getLogChannel(guild, client);
      if (logChannel) {
        console.log(`📋 Salon de logs prêt ou existant dans ${guild.name}`);
      } else {
        console.warn(`⚠️ Pas pu configurer un salon de logs dans ${guild.name}`);
      }
    } catch (error) {
      console.error(`❌ Erreur dans ${guild.name} (${guild.id}) :`, error.message);
    }
  }
});


client.on('guildCreate', async guild => {
  const embed = new EmbedBuilder()
    .setTitle('✅ Nouveau serveur rejoint !')
    .setColor('Green')
    .setDescription([
      `Merci de m'avoir ajouté à **${guild.name}** !`,
      '',
      '**Pensez à activer les options de l\'antiraid**',
      '**Activez les logs pour une meilleure surveillance**',
      '**Besoin d\'aide ? Essayez la commande `/help`**',
      '**Pensez à mettre le bot tout en haut de la hiérarchie pour une sécurité complète !**',
      '**Pour toute question, rejoignez le support :** [Support](https://discord.gg/vpnw6VECPR)',
    ].join('\n'))
    .setImage('https://cdn.discordapp.com/attachments/1362448219958939751/1376281039198224595/logo5_17_171957.png?ex=683569d9&is=68341859&hm=8ab4843af9c3a1852a9e5bfaf12e0adeed3d40a82ce9d319ce92fa0eb1c1bdc8&')
    .setTimestamp();

  
  const defaultChannel = guild.channels.cache.find(channel =>
    channel.isTextBased() &&
    channel.permissionsFor(guild.members.me).has('SendMessages')
  );

  if (defaultChannel) {
    defaultChannel.send({ embeds: [embed] }).catch(console.error);
  }
});


client.on('guildCreate', async (guild) => {
  try {
    updateStatusLoop();
    const logChannel = await getLogChannel(guild, client);
    if (logChannel) {
      console.log(`✅ Salon de logs créé dans ${guild.name}`);
    } else {
      console.warn(`❌ Impossible de créer un salon de logs dans ${guild.name}`);
    }
  } catch (err) {
    console.error(`❌ Erreur lors du guildCreate dans ${guild.name}`, err);
  }
});


client.on('guildDelete', async (guild) => {
  kickedGuilds.add(guild.id);
  console.log(`Le bot a été kické du serveur ${guild.name} (ID: ${guild.id})`);
  updateStatusLoop();
  
  
  try {
    const guildDeleteHandler = require('./events/guildDelete.js');
    if (guildDeleteHandler && guildDeleteHandler.execute) {
      await guildDeleteHandler.execute(guild);
    }
  } catch (error) {
    console.error('❌ Erreur guildDelete handler:', error);
  }
});


client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Erreur lors de l'exécution de la commande ${interaction.commandName}:`, error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Une erreur est survenue !', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Une erreur est survenue !', ephemeral: true });
      }
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      await interactionCreate1Handler.execute(interaction);
    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution de interactionCreate1Handler:', error);
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  
  const botMentioned = message.mentions.has(client.user);

  
  const mentionsEveryone = message.mentions.everyone;

  
  const roleMentions = message.mentions.roles.size > 0;

  if (botMentioned && !mentionsEveryone && !roleMentions) {
    const embed = new EmbedBuilder()
      .setTitle('ℹ️ Tu m\'as mentionné ?')
      .setDescription("Voici quelques options utiles :\n\n> 🏠 Utilise /help pour voir mes commandes\n> 🤖 Besoin d'aide ? Rejoins notre [serveur support](https://discord.gg/crQ9Qgzbck)")
      .setColor('Blurple')
      .setFooter({ text: `Mentionné par ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
});


console.log(client.commands.map(cmd => cmd.data.name));
client.login(process.env.TOKEN);