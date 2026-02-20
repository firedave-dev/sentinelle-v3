const { Client, GatewayIntentBits, Partials, Collection, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

console.log("✅ Test emoji : le bot démarre correctement 🚀");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User]
});

client.commands = new Collection();


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

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

const logsPath = path.join(__dirname, 'logs');
if (fs.existsSync(logsPath)) {
  const logFiles = fs.readdirSync(logsPath).filter(file => file.endsWith('.js'));
  for (const file of logFiles) {
    const logModule = require(path.join(logsPath, file));
    if (typeof logModule === 'function') {
      logModule(client);
    }
  }
} else {
  console.warn("📁 Dossier 'logs' non trouvé.");
}

client.once('ready', async () => {
  console.log(`🤖 Le bot est prêt ! Connecté en tant que ${client.user.tag}`);

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const botMember = guild.members.me;
      if (!botMember) {
        console.warn(`❌ Le bot n’est pas membre de ${guild.name}`);
        continue;
      }

      const logsChannel = guild.channels.cache.find(
        c =>
          c.name === 'logs' &&
          c.type === ChannelType.GuildText &&
          c.topic === 'Salon de logs automatique créé par Sentinelle 🛡️'
      );

      if (!logsChannel) {
        console.warn(`⚠️ Aucun salon logs trouvé dans ${guild.name}`);
        continue;
      }

      const permissions = logsChannel.permissionsFor(botMember);
      if (!permissions || !permissions.has('SendMessages')) {
        console.warn(`❌ Pas la permission d’envoyer dans ${logsChannel.name} (${guild.name})`);
        continue;
      }

      console.log(`🔍 Salon logs trouvé et valide dans ${guild.name}`);
    } catch (error) {
      console.error(`❌ Erreur dans la guilde ${guild.name} (${guild.id}) :`, error.message);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

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
});

console.log(client.commands.map(cmd => cmd.data.name));
client.login(process.env.TOKEN);