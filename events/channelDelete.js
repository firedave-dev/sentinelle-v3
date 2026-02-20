const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');

const userDeletions = new Map();
const userCreations = new Map();
const userCooldowns = new Map();

const COOLDOWN_MS = 30 * 1000;

// ⚡ OPTIMISATIONS ANTI-RAID
const DETECTION_WINDOW = 800; // Fenêtre de détection réduite à 800ms (au lieu de 3000ms)
const BURST_THRESHOLD = 2; // 2 suppressions/créations en rafale
const BURST_WINDOW = 400; // en moins de 400ms = comportement suspect

module.exports = function (client) {
  // ========================================
  // 🗑️ GESTION DES SUPPRESSIONS DE CHANNELS
  // ========================================
  client.on('channelDelete', async (channel) => {
    const guild = channel.guild;

    try {
      const configAll = await loadAntiRaidConfig();
      const config = configAll[guild.id];
      if (!config || !config.channelManipulation) return;

      const logConfig = await getLoggingConfig(guild.id);

      let logChannel;
      if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
        logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
      } else {
        logChannel = guild.channels.cache.get(logConfig.logChannelId);
        if (!logChannel || typeof logChannel.send !== 'function') {
          logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
        }
      }

      // --- safeSend : protège contre Unknown Channel / Missing Access etc.
      const safeSend = async (msg) => {
        try {
          if (
            logChannel &&
            typeof logChannel.send === 'function' &&
            guild &&
            guild.members &&
            guild.members.me &&
            logChannel.permissionsFor &&
            logChannel.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)
          ) {
            await logChannel.send(msg);
          } else {
            console.log(`[AntiRaid LOG] ${msg}`);
          }
        } catch (err) {
          console.error('[AntiRaid] Impossible d\'envoyer un message de log:', err);
          try { console.log(`[AntiRaid LOG] ${msg}`); } catch {}
        }
      };
      // --- end safeSend

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        console.warn(`[AntiRaid] ⚠️ Permission "View Audit Log" manquante dans ${guild.name}`);
        try {
          await safeSend(`⚠️ **Anti-Raid** : Permission "View Audit Log" manquante. Impossible de surveiller les suppressions de salons.`);
        } catch {
          console.log(`[AntiRaid] Permission "View Audit Log" manquante dans ${guild.name}`);
        }
        return;
      }

      let executor;
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelDelete,
          limit: 1,
        });
        const entry = logs.entries.first();
        executor = entry?.executor;
        if (!executor) return;
      } catch (err) {
        if (err.code === 50013) {
          console.warn(`[AntiRaid] ⚠️ Permission "View Audit Log" insuffisante dans ${guild.name}`);
          try {
            await safeSend(`⚠️ **Anti-Raid** : Permission "View Audit Log" insuffisante.`);
          } catch {
            console.log(`[AntiRaid] Permission "View Audit Log" insuffisante dans ${guild.name}`);
          }
        } else {
          console.error("[AntiRaid] Erreur récupération logs d'audit :", err);
        }
        return;
      }

      const key = `${guild.id}-${executor.id}`;

      // Vérifier le cooldown
      const cooldownUntil = userCooldowns.get(key) || 0;
      if (Date.now() < cooldownUntil) {
        return;
      }

      const now = Date.now();
      const threshold = config.thresholds?.maxChannelActionsPer800ms || 3;

      const previous = userDeletions.get(key) || [];
      const recent = previous.filter(ts => now - ts < DETECTION_WINDOW);
      recent.push(now);

      // 🚨 DÉTECTION DE RAFALE (BURST) - Ban immédiat si 2 suppressions en 400ms
      if (recent.length >= BURST_THRESHOLD) {
        const burstRecent = recent.filter(ts => now - ts < BURST_WINDOW);
        if (burstRecent.length >= BURST_THRESHOLD) {
          console.warn(`[AntiRaid] 🚨 RAFALE DÉTECTÉE : ${executor.tag} a supprimé ${burstRecent.length} salons en ${BURST_WINDOW}ms !`);
          
          // Procéder au ban immédiat
          userDeletions.set(key, [now]);

          try {
            await safeSend(`🚨 **ALERTE RAFALE** : ${executor.tag} a supprimé ${burstRecent.length} salons en moins de ${BURST_WINDOW}ms !`);
          } catch (error) {
            console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
          }

          return await handleBan(executor, guild, botMember, key, safeSend, client, 'Rafale de suppressions de salons détectée');
        }
      }

      // Détection normale (3 suppressions dans la fenêtre)
      if (recent.length < threshold) {
        userDeletions.set(key, recent);
        try {
          await safeSend(`⚠️ ${executor.tag} a supprimé un salon. (${recent.length}/${threshold}) - Fenêtre: ${DETECTION_WINDOW}ms`);
        } catch (error) {
          console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
        }
      } else if (recent.length >= threshold) {
        userDeletions.set(key, [now]);

        try {
          await safeSend(`🚨 ${executor.tag} a atteint le seuil : ${recent.length}/${threshold} suppressions en ${DETECTION_WINDOW}ms !`);
        } catch (error) {
          console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
        }

        return await handleBan(executor, guild, botMember, key, safeSend, client, 'Suppression massive de salons détectée');
      }
    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans channelDelete :', err);
    }
  });

  // ========================================
  // ➕ GESTION DES CRÉATIONS DE CHANNELS
  // ========================================
  client.on('channelCreate', async (channel) => {
    const guild = channel.guild;

    try {
      const configAll = await loadAntiRaidConfig();
      const config = configAll[guild.id];
      if (!config || !config.channelManipulation) return;

      const logConfig = await getLoggingConfig(guild.id);

      let logChannel;
      if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
        logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
      } else {
        logChannel = guild.channels.cache.get(logConfig.logChannelId);
        if (!logChannel || typeof logChannel.send !== 'function') {
          logChannel = { send: (msg) => console.log(`[AntiRaid LOG] ${msg}`) };
        }
      }

      // --- safeSend : protège contre Unknown Channel / Missing Access etc.
      const safeSend = async (msg) => {
        try {
          if (
            logChannel &&
            typeof logChannel.send === 'function' &&
            guild &&
            guild.members &&
            guild.members.me &&
            logChannel.permissionsFor &&
            logChannel.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)
          ) {
            await logChannel.send(msg);
          } else {
            console.log(`[AntiRaid LOG] ${msg}`);
          }
        } catch (err) {
          console.error('[AntiRaid] Impossible d\'envoyer un message de log:', err);
          try { console.log(`[AntiRaid LOG] ${msg}`); } catch {}
        }
      };
      // --- end safeSend

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        console.warn(`[AntiRaid] ⚠️ Permission "View Audit Log" manquante dans ${guild.name}`);
        try {
          await safeSend(`⚠️ **Anti-Raid** : Permission "View Audit Log" manquante. Impossible de surveiller les créations de salons.`);
        } catch {
          console.log(`[AntiRaid] Permission "View Audit Log" manquante dans ${guild.name}`);
        }
        return;
      }

      let executor;
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelCreate,
          limit: 1,
        });
        const entry = logs.entries.first();
        executor = entry?.executor;
        if (!executor) return;
      } catch (err) {
        if (err.code === 50013) {
          console.warn(`[AntiRaid] ⚠️ Permission "View Audit Log" insuffisante dans ${guild.name}`);
          try {
            await safeSend(`⚠️ **Anti-Raid** : Permission "View Audit Log" insuffisante.`);
          } catch {
            console.log(`[AntiRaid] Permission "View Audit Log" insuffisante dans ${guild.name}`);
          }
        } else {
          console.error("[AntiRaid] Erreur récupération logs d'audit :", err);
        }
        return;
      }

      const key = `${guild.id}-${executor.id}`;

      // Vérifier le cooldown
      const cooldownUntil = userCooldowns.get(key) || 0;
      if (Date.now() < cooldownUntil) {
        return;
      }

      const now = Date.now();
      const threshold = config.thresholds?.maxChannelActionsPer800ms || 3;

      const previous = userCreations.get(key) || [];
      const recent = previous.filter(ts => now - ts < DETECTION_WINDOW);
      recent.push(now);

      // 🚨 DÉTECTION DE RAFALE (BURST) - Ban immédiat si 2 créations en 400ms
      if (recent.length >= BURST_THRESHOLD) {
        const burstRecent = recent.filter(ts => now - ts < BURST_WINDOW);
        if (burstRecent.length >= BURST_THRESHOLD) {
          console.warn(`[AntiRaid] 🚨 RAFALE DÉTECTÉE : ${executor.tag} a créé ${burstRecent.length} salons en ${BURST_WINDOW}ms !`);
          
          // Procéder au ban immédiat
          userCreations.set(key, [now]);

          try {
            await safeSend(`🚨 **ALERTE RAFALE** : ${executor.tag} a créé ${burstRecent.length} salons en moins de ${BURST_WINDOW}ms !`);
          } catch (error) {
            console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
          }

          return await handleBan(executor, guild, botMember, key, safeSend, client, 'Rafale de créations de salons détectée');
        }
      }

      // Détection normale (3 créations dans la fenêtre)
      if (recent.length < threshold) {
        userCreations.set(key, recent);
        try {
          await safeSend(`⚠️ ${executor.tag} a créé un salon. (${recent.length}/${threshold}) - Fenêtre: ${DETECTION_WINDOW}ms`);
        } catch (error) {
          console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
        }
      } else if (recent.length >= threshold) {
        userCreations.set(key, [now]);

        try {
          await safeSend(`🚨 ${executor.tag} a atteint le seuil : ${recent.length}/${threshold} créations en ${DETECTION_WINDOW}ms !`);
        } catch (error) {
          console.error("[AntiRaid] Impossible d'envoyer un message de log:", error);
        }

        return await handleBan(executor, guild, botMember, key, safeSend, client, 'Création massive de salons détectée');
      }
    } catch (err) {
      console.error('[AntiRaid] Erreur inattendue dans channelCreate :', err);
    }
  });
};

// Fonction dédiée pour gérer le ban (évite la duplication de code)
async function handleBan(executor, guild, botMember, key, safeSend, client, reason) {
  if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    try {
      await safeSend(`💡 Je n'ai pas la permission de bannir <@${executor.id}>.`);
    } catch {
      console.log(`❌ Pas la permission de bannir <@${executor.id}>.`);
    }
    return;
  }

  let member;
  try {
    member = await guild.members.fetch(executor.id);
  } catch (fetchErr) {
    if (fetchErr.code === 10007) {
      try {
        await safeSend(`❌ Impossible de bannir <@${executor.id}> : membre introuvable (déjà parti).`);
      } catch {
        console.log(`❌ Membre introuvable (déjà parti) : <@${executor.id}>.`);
      }
      userDeletions.delete(key);
      userCreations.delete(key);
      userCooldowns.set(key, Date.now() + 30000);
      return;
    } else {
      console.error('[AntiRaid] Erreur fetch membre :', fetchErr);
      return;
    }
  }

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    try {
      await safeSend(`❌ Hiérarchie empêche le ban de <@${executor.id}>.`);
    } catch {
      console.log(`❌ Hiérarchie empêche le ban de <@${executor.id}>.`);
    }
    userDeletions.delete(key);
    userCreations.delete(key);
    userCooldowns.set(key, Date.now() + 30000);
    return;
  }

  try {
    await member.ban({ reason: `Anti-Raid: ${reason}` });
    try {
      await safeSend(`⚔️ **Anti-Raid** : ${executor.tag} a été banni. Raison : ${reason}`);
    } catch {
      console.log(`🚨 **Anti-Raid** : ${executor.tag} a été banni. Raison : ${reason}`);
    }

    client.emit('antiraidTriggered', guild, {
      reason: reason,
      action: 'Ban automatique',
      suspects: [executor.tag],
    });

    userDeletions.delete(key);
    userCreations.delete(key);
    userCooldowns.set(key, Date.now() + 30000);

  } catch (banErr) {
    if (banErr.code === 10007) {
      try {
        await safeSend(`❌ Impossible de bannir <@${executor.id}> : membre introuvable (déjà parti).`);
      } catch {
        console.log(`❌ Membre introuvable (déjà parti) : <@${executor.id}>.`);
      }
      userDeletions.delete(key);
      userCreations.delete(key);
      userCooldowns.set(key, Date.now() + 30000);
    } else {
      console.error('[AntiRaid] Erreur lors du ban :', banErr);
      try {
        await safeSend(`❌ Erreur lors du ban de <@${executor.id}> : ${banErr.message}`);
      } catch {
        console.log(`❌ Erreur lors du ban de <@${executor.id}> : ${banErr.message}`);
      }
    }
  }
}