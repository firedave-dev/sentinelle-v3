const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

function loadCommandsRecursively(dir) {
  if (!fs.existsSync(dir)) {
    console.warn("⚠️ Dossier 'commands' non trouvé.");
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadCommandsRecursively(fullPath);
    } else if (file.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        console.warn(`⚠️ Commande invalide : ${file}`);
      }
    }
  }
}

loadCommandsRecursively(commandsPath);


const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`🚀 Déploiement GLOBAL de ${commands.length} commande(s)...`);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID), 
      { body: commands }
    );

    console.log('✅ Commandes globales déployées avec succès !');
  } catch (error) {
    console.error('❌ Erreur pendant le déploiement :', error);
  }
})();