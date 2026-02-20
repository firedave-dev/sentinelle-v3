const { Events } = require('discord.js');
const interactionCreate1Handler = require('./interactionCreate1.js');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`❌ Erreur commande ${interaction.commandName}:`, error);
        const replyPayload = { content: 'Une erreur est survenue !', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => {});
        } else {
          await interaction.reply(replyPayload).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        await interactionCreate1Handler.execute(interaction);
      } catch (error) {
        console.error('❌ Erreur interactionCreate1Handler:', error);
      }
    }
  }
};