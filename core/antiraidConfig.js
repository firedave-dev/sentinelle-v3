const defaultConfig = {
  enabled: true,
  protections: {
    channelManipulation: { enabled: true }, // ✅ Gère create + delete
    guildMemberAdd: { enabled: true },
    messageCreate: { enabled: true },
    roleDelete: { enabled: true },
    aiAnalyzer: { enabled: true }, 
    botAdd: { enabled: true }
  },
  thresholds: {
    maxJoinsPerMinute: 5,
    maxMessagesPerSecond: 10,
    maxRoleCreationsPerMinute: 3,
    maxChannelActionsPer800ms: 3, // ✅ Pour create + delete combinés
    maxRoleDeletesPer800ms: 3,
    maxAiAnalyzersPerMinute: 2, 
    maxBotAddsPerMinute: 1 
  },
  punishments: {
    onJoinFlood: 'kick',
    onSpam: 'timeout',
    onChannelManipulation: 'ban', // ✅ Pour les deux actions
    onRoleCreate: 'kick',
    onRoleDelete: 'ban',
    onAiAnalyzer: 'timeout', 
    onBotAdd: 'kick' 
  },
  alert: {
    logChannelName: 'logs',
    pingRoles: ['admin', 'mod'],
    sendDMToUser: true,
  },
};
module.exports = defaultConfig;