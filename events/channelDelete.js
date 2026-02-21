const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');

const userChannelDeletions = new Map();

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        if (!channel.guild) return;
        const { guild } = channel;

        const configAll = client.antiraidConfig || await loadAntiRaidConfig();
        if (!configAll[guild.id]?.channelManipulation) return;

        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (!entry) return;

        const { executor } = entry;
        if (executor.id === client.user.id || executor.id === guild.ownerId) return;

        const key = `${guild.id}-${executor.id}`;
        const now = Date.now();
        const logs = userChannelDeletions.get(key) || [];
        
        logs.push(now);
        // Fenêtre de 1 seconde pour détecter un "Mass Delete"
        const recent = logs.filter(t => now - t < 1000);
        userChannelDeletions.set(key, recent);

        if (recent.length >= 2) { // Si + de 2 salons supprimés en 1s
            const member = await guild.members.fetch(executor.id).catch(() => null);
            if (member && member.bannable) {
                await member.ban({ reason: 'Anti-Raid : Suppression massive de salons' }).catch(() => {});
                
                // On utilise l'émetteur d'event centralisé pour les logs
                client.emit('antiraidTriggered', guild, {
                    reason: 'Mass Channel Delete',
                    action: 'Ban automatique',
                    suspects: [executor.tag]
                });
            }
        }
    }
};