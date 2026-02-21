const { Events } = require('discord.js');
const { saveAntiRaidConfig, loadAntiRaidConfig } = require('../core/antiraidStorage');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('antiraid_')) return;

        // Sécurité : Seul l'owner ou un admin peut toucher à ça
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: "Tu n'as pas la permission.", ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configAll = await loadAntiRaidConfig();
        const config = configAll[guildId] || {};
        
        // On récupère l'action (ex: 'botAdd', 'antiPing') depuis l'ID du bouton
        const action = interaction.customId.replace('antiraid_', '');

        // On inverse la valeur actuelle (True -> False / False -> True)
        config[action] = !config[action];
        
        configAll[guildId] = config;
        await saveAntiRaidConfig(configAll);
        client.reloadAntiRaidConfig(); // On met à jour le cache du client

        const status = config[action] ? '✅ Activé' : '❌ Désactivé';
        await interaction.reply({ 
            content: `Le module **${action}** est maintenant ${status}.`, 
            ephemeral: true 
        });
    }
};