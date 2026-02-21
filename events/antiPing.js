const { Events, PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const configAll = client.antiraidConfig || await loadAntiRaidConfig();
        const config = configAll[message.guild.id];
        if (!config || !config.antiPing) return;

        // Si le message contient @everyone ou @here
        if (message.content.includes('@everyone') || message.content.includes('@here')) {
            const member = await message.guild.members.fetch(message.author.id).catch(() => null);
            
            // Si l'utilisateur n'a pas la permission de mentionner everyone
            if (member && !member.permissions.has(PermissionsBitField.Flags.MentionEveryone)) {
                await message.delete().catch(() => {});
                
                // Sanction : Timeout de 1h pour calmer le jeu
                if (member.moderatable) {
                    await member.timeout(60 * 60 * 1000, 'Anti-Ping : Mention non autorisée');
                }

                client.emit('antiraidTriggered', message.guild, {
                    reason: 'Tentative de mention @everyone/here',
                    action: 'Message supprimé + Timeout 1h',
                    suspects: [message.author.tag]
                });
            }
        }
    }
};