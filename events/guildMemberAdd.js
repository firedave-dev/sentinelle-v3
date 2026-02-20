const { ChannelType } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const lastRaidAlert = new Map();

module.exports = function (client) {
  if (!client.raidTracking) client.raidTracking = {};
  
  client.on('guildMemberAdd', async (member) => {
    try {
      const configAll = await loadAntiRaidConfig();
      const config = configAll[member.guild.id];
      
      if (!config || !config.guildMemberAdd) return;
      
      const now = Date.now();
      if (!client.raidTracking[member.guild.id]) {
        client.raidTracking[member.guild.id] = { joins: [] };
      }
      
      const tracker = client.raidTracking[member.guild.id];
      
      if (!Array.isArray(tracker.joins)) tracker.joins = [];
      
      tracker.joins = tracker.joins.filter(t => now - t < 8000);
      tracker.joins.push(now);
      
      const logChannelName = config.alert?.logChannelName || 'logs';
      const logChannel = member.guild.channels.cache.find(
        c => c.name === logChannelName && c.type === ChannelType.GuildText
      );
      
      if (tracker.joins.length >= 5) {
        const suspects = [];
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let recentMembers;
        try {
          const fetched = await member.guild.members.fetch({ withPresences: false });
          recentMembers = fetched.filter(m => !m.user.bot && (now - m.joinedTimestamp) < 8000);
        } catch {
          recentMembers = member.guild.members.cache.filter(m => !m.user.bot && (now - m.joinedTimestamp) < 8000);
        }
        
        for (const recentMember of recentMembers.values()) {
          try {
            const freshMember = await member.guild.members.fetch(recentMember.id).catch(() => null);
            
            if (!freshMember) {
              console.log(`[AntiRaid] ${recentMember.user.tag} a quitté le serveur`);
              continue;
            }
            
            if (!freshMember.moderatable) {
              console.log(`[AntiRaid] Impossible de timeout ${recentMember.user.tag} (permissions insuffisantes)`);
              continue;
            }
            
            try {
              await freshMember.send(
                "⚠️ Vous avez été mis en **timeout automatique** pendant 2 minutes suite à une détection d'arrivée massive sur le serveur. Si vous pensez qu'il s'agit d'une erreur, veuillez contacter un modérateur."
              );
            } catch {}
            
            await freshMember.timeout(120_000, 'Arrivée massive détectée');
            suspects.push(freshMember.user.tag);
            
          } catch (err) {
            if (err.code === 10007) {
              console.log(`[AntiRaid] ${recentMember.user.tag} n'existe plus sur le serveur`);
            } else if (err.code === 50013) {
              console.log(`[AntiRaid] Permissions manquantes pour timeout ${recentMember.user.tag}`);
            } else {
              console.error(`[AntiRaid] Erreur timeout ${recentMember.user.tag}:`, err.message);
            }
          }
        }
        
        const lastAlertTime = lastRaidAlert.get(member.guild.id) || 0;
        if (now - lastAlertTime > 10000) {
          if (logChannel) {
            try {
              await logChannel.send(
                `🚨 **Anti-Raid** : Arrivée massive détectée. ${suspects.length} membre(s) ont été timeout.`
              );
            } catch (error) {
              console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
            }
          } else {
            console.log(
              `[AntiRaid] Arrivée massive détectée sur ${member.guild.name}. ${suspects.length} membres timeout.`
            );
          }
          lastRaidAlert.set(member.guild.id, now);
        }
        
        client.emit('antiraidTriggered', member.guild, {
          reason: 'Arrivées massives',
          action: 'Timeout automatique',
          suspects,
        });
        
        console.log(`[AntiRaid] ${suspects.length} membre(s) timeout sur ${member.guild.name}`);
        tracker.joins = [];
      }
    } catch (err) {
      console.error("[AntiRaid] Erreur inattendue dans guildMemberAdd :", err);
    }
  });
};