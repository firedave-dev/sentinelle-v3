const { AuditLogEvent, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { loadAntiRaidConfig } = require('../core/antiraidStorage');
const { getLoggingConfig } = require('../core/logSettingsManager');
const fs = require('fs').promises;
const path = require('path');

class IntelligentAntiRaid {
  constructor() {
    this.AI_CONFIG_PATH = path.join(__dirname, '../data/IA.json');
    
    this.riskFactors = {
      accountAge: {
        veryNew: { threshold: 24 * 60 * 60 * 1000, weight: 0.4 }, 
        new: { threshold: 7 * 24 * 60 * 60 * 1000, weight: 0.2 }, 
        medium: { threshold: 30 * 24 * 60 * 60 * 1000, weight: 0.1 } 
      },
      joinVelocity: {
        mass: { threshold: 15, weight: 0.5 }, 
        high: { threshold: 8, weight: 0.3 },  
        moderate: { threshold: 5, weight: 0.1 } 
      },
      coordination: {
        perfect: { varianceThreshold: 5000, weight: 0.4 }, 
        high: { varianceThreshold: 15000, weight: 0.3 },   
        moderate: { varianceThreshold: 30000, weight: 0.2 } 
      },
      behavior: {
        noAvatar: { weight: 0.15 },
        botLike: { weight: 0.25 },
        suspiciousUsername: { weight: 0.2 }
      },
      massActions: {
        massBan: { threshold: 5, weight: 0.6 },
        massKick: { threshold: 5, weight: 0.5 },
        massRoleDelete: { threshold: 3, weight: 0.5 },
        massChannelDelete: { threshold: 3, weight: 0.5 },
        massWebhook: { threshold: 4, weight: 0.4 }
      }
    };

    this.guildProfiles = new Map();
    this.knownPatterns = new Map();
    this.falsePositiveMemory = new Map();
    this.guildAnalytics = new Map();
    this.alertCooldowns = new Map();
    this.processingQueue = new Map();
    
    
    this.trustedModerators = new Map();
    this.moderatorActions = new Map();
    
    
    this.gracePeriods = new Map();
    
    this.saveLock = false;
    
    this.config = {
      baseThreshold: 0.5,
      learningRate: 0.1,
      memoryWindow: 24 * 60 * 60 * 1000,
      analysisWindow: 10 * 60 * 1000,
      cooldownPeriod: 30 * 1000,
      falsePositiveThreshold: 0.3,
      auditLogTimeout: 10000,
      maxPatterns: 5000,
      maxTimestamps: 1000,
      maxSuspiciousUsers: 500,
      maxAccountAges: 500,
      throttleMs: 100,
      maxConcurrentAnalyses: 10,
      verboseLogging: false,
      logLevel: 'essential',
      maintenanceLogInterval: 10
    };

    this.logCounters = {
      maintenance: 0,
      saves: 0,
      reports: 0
    };

    this.metrics = {
      totalAnalyses: 0,
      totalAlerts: 0,
      falsePositives: 0,
      confirmedThreats: 0
    };

    this.initializeSystem();
  }

  log(level, message, data = null) {
    const { logLevel } = this.config;
    
    if (logLevel === 'silent') return;
    if (logLevel === 'essential' && level === 'verbose') return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [AntiRaid ${level.toUpperCase()}]`;
    
    if (data && typeof data === 'object') {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  async initializeSystem() {
    try {
      await this.loadHistoricalData();
      this.log('essential', '🛡️ Anti-Raid Intelligent v2.4 initialisé avec succès');
    } catch (error) {
      this.log('essential', '❌ Erreur initialisation:', error.message);
    }
  }

  async loadHistoricalData() {
    try {
      const dataDir = path.dirname(this.AI_CONFIG_PATH);
      try {
        await fs.access(dataDir);
      } catch {
        await fs.mkdir(dataDir, { recursive: true });
      }

      const data = await fs.readFile(this.AI_CONFIG_PATH, 'utf8');
      const historicalData = this.validateLoadedData(JSON.parse(data));
      
      if (historicalData.trainingData && historicalData.experienceMemory) {
        this.convertLegacyData(historicalData);
      }

      if (historicalData.intelligentSystem) {
        if (historicalData.intelligentSystem.guildProfiles) {
          this.guildProfiles = new Map(Object.entries(historicalData.intelligentSystem.guildProfiles));
          
          
          for (const [guildId, profile] of this.guildProfiles.entries()) {
            if (profile.adaptiveThreshold > 0.7) {
              const oldThreshold = profile.adaptiveThreshold;
              profile.adaptiveThreshold = 0.55;
              profile.falseAlerts = Math.floor(profile.falseAlerts / 3);
              this.log('essential', `🔧 Reset seuil ${guildId}: ${oldThreshold.toFixed(2)} → 0.55 | FP: ${profile.falseAlerts}`);
            }
            
            const totalEvents = profile.raidHistory + profile.falseAlerts;
            const errorRate = totalEvents > 0 ? profile.falseAlerts / totalEvents : 0;
            
            if (errorRate > 0.95 && profile.adaptiveThreshold > 0.80 && profile.falseAlerts > 50) {
              this.log('essential', `🔥 RESET profil corrompu ${guildId}: ${profile.falseAlerts} FP → ${Math.floor(profile.falseAlerts / 10)}`);
              profile.falseAlerts = Math.floor(profile.falseAlerts / 10);
              profile.adaptiveThreshold = 0.60;
              profile.lastUpdate = Date.now();
              
              
              this.createGracePeriod(guildId, 60 * 60 * 1000);
            }
          }
        }
        if (historicalData.intelligentSystem.knownPatterns) {
          this.knownPatterns = new Map(Object.entries(historicalData.intelligentSystem.knownPatterns));
          if (this.knownPatterns.size > this.config.maxPatterns) {
            this.pruneOldPatterns();
          }
        }
        if (historicalData.intelligentSystem.falsePositiveMemory) {
          this.falsePositiveMemory = new Map(Object.entries(historicalData.intelligentSystem.falsePositiveMemory));
        }
      }

      this.log('verbose', '✅ Données historiques chargées');
    } catch (error) {
      this.log('verbose', '📝 Création d\'un nouveau profil système');
      await this.saveSystemData();
    }
  }

  validateLoadedData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }

    const sanitized = {};
    
    if (data.intelligentSystem && typeof data.intelligentSystem === 'object') {
      sanitized.intelligentSystem = {
        guildProfiles: this.sanitizeMap(data.intelligentSystem.guildProfiles),
        knownPatterns: this.sanitizeMap(data.intelligentSystem.knownPatterns),
        falsePositiveMemory: this.sanitizeMap(data.intelligentSystem.falsePositiveMemory)
      };
    }

    if (data.trainingData && Array.isArray(data.trainingData)) {
      sanitized.trainingData = data.trainingData;
    }

    if (data.experienceMemory && typeof data.experienceMemory === 'object') {
      sanitized.experienceMemory = data.experienceMemory;
    }

    return sanitized;
  }

  sanitizeMap(data) {
    if (!data || typeof data !== 'object') return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof key === 'string' && value !== null && typeof value === 'object') {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  pruneOldPatterns() {
    const patterns = Array.from(this.knownPatterns.entries());
    patterns.sort((a, b) => (b[1].occurrences || 0) - (a[1].occurrences || 0));
    
    this.knownPatterns.clear();
    patterns.slice(0, this.config.maxPatterns).forEach(([key, value]) => {
      this.knownPatterns.set(key, value);
    });
    
    this.log('essential', `🧹 Nettoyage patterns: ${patterns.length} → ${this.knownPatterns.size}`);
  }

  convertLegacyData(legacyData) {
    if (legacyData.trainingData) {
      const raidExamples = legacyData.trainingData.filter(ex => ex.threat > 0.7);
      
      raidExamples.forEach(example => {
        const pattern = this.analyzeFeaturePattern(example.features);
        this.knownPatterns.set(pattern.id, {
          ...pattern,
          confidence: 0.8,
          occurrences: 1
        });
      });
    }

    if (legacyData.experienceMemory) {
      Object.entries(legacyData.experienceMemory).forEach(([guildId, data]) => {
        this.guildProfiles.set(guildId, {
          raidHistory: data.incidents || 0,
          falseAlerts: data.falsePositives || 0,
          adaptiveThreshold: this.calculateAdaptiveThreshold(data),
          lastUpdate: Date.now()
        });
      });
    }
  }

  analyzeFeaturePattern(features) {
    return {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      features: features,
      timestamp: Date.now()
    };
  }

  async throttleAnalysis(guildId) {
    const lastProcessing = this.processingQueue.get(guildId);
    const now = Date.now();
    
    if (lastProcessing && (now - lastProcessing) < this.config.throttleMs) {
      return false;
    }
    
    this.processingQueue.set(guildId, now);
    return true;
  }

  
  createGracePeriod(guildId, durationMs = 30 * 60 * 1000) {
    this.gracePeriods.set(guildId, Date.now() + durationMs);
    this.log('essential', `⏰ Période de grâce activée pour ${guildId} (${durationMs/60000} min)`);
  }

  isInGracePeriod(guildId) {
    const endTime = this.gracePeriods.get(guildId);
    if (!endTime) return false;
    
    if (Date.now() < endTime) {
      return true;
    } else {
      this.gracePeriods.delete(guildId);
      return false;
    }
  }

  analyzeEvent(context) {
    this.metrics.totalAnalyses++;
    
    
    if (this.isInGracePeriod(context.guild.id)) {
      this.log('verbose', `⏰ Serveur en période de grâce: ${context.guild.id}`);
      return {
        threatLevel: 0,
        confidence: 0,
        threats: [],
        isFalsePositive: true,
        reasoning: '⏰ Période de grâce active après reset du profil',
        guildProfile: this.guildProfiles.get(context.guild.id)
      };
    }
    
    const { guild, event, recentActivity, userProfile } = context;
    
    const ruleScore = this.calculateRuleBasedScore(context);
    const patternScore = this.analyzePatterns(context);
    
    const guildProfile = this.guildProfiles.get(guild.id) || this.createGuildProfile(guild.id);
    const adaptiveMultiplier = this.calculateAdaptiveMultiplier(guildProfile, context);
    
    const finalScore = (ruleScore * 0.6 + patternScore * 0.4) * adaptiveMultiplier;
    
    const isFalsePositive = this.detectFalsePositive(context, finalScore);
    const adjustedScore = isFalsePositive ? finalScore * 0.5 : finalScore;
    
    const confidence = this.calculateConfidence(guildProfile, adjustedScore);
    const threats = this.identifySpecificThreats(context, adjustedScore);
    
    if (isFalsePositive) {
      this.metrics.falsePositives++;
    } else if (adjustedScore >= 0.5) {
      this.metrics.totalAlerts++;
    }
    
    return {
      threatLevel: Math.min(adjustedScore, 1),
      confidence,
      threats,
      isFalsePositive,
      reasoning: this.generateIntelligentReasoning(context, adjustedScore, threats, isFalsePositive),
      guildProfile
    };
  }

  calculateRuleBasedScore(context) {
    const { recentActivity, userProfile } = context;
    let score = 0;

    if (userProfile) {
      const accountAge = Date.now() - userProfile.createdTimestamp;
      const { accountAge: ageRules } = this.riskFactors;
      
      if (accountAge < ageRules.veryNew.threshold) {
        score += ageRules.veryNew.weight;
      } else if (accountAge < ageRules.new.threshold) {
        score += ageRules.new.weight;
      } else if (accountAge < ageRules.medium.threshold) {
        score += ageRules.medium.weight;
      }
    }

    const joinRate = recentActivity.newJoins || 0;
    const { joinVelocity } = this.riskFactors;
    
    if (joinRate >= joinVelocity.mass.threshold) {
      score += joinVelocity.mass.weight;
    } else if (joinRate >= joinVelocity.high.threshold) {
      score += joinVelocity.high.weight;
    } else if (joinRate >= joinVelocity.moderate.threshold) {
      score += joinVelocity.moderate.weight;
    }

    const coordination = this.calculateCoordination(recentActivity);
    const { coordination: coordRules } = this.riskFactors;
    
    if (coordination.variance < coordRules.perfect.varianceThreshold) {
      score += coordRules.perfect.weight;
    } else if (coordination.variance < coordRules.high.varianceThreshold) {
      score += coordRules.high.weight;
    } else if (coordination.variance < coordRules.moderate.varianceThreshold) {
      score += coordRules.moderate.weight;
    }

    if (userProfile) {
      if (!userProfile.hasAvatar) score += this.riskFactors.behavior.noAvatar.weight;
      if (userProfile.isBot) score += this.riskFactors.behavior.botLike.weight;
      if (this.isSuspiciousUsername(userProfile.username)) {
        score += this.riskFactors.behavior.suspiciousUsername.weight;
      }
    }

    const { massActions } = this.riskFactors;
    if (recentActivity.bans >= massActions.massBan.threshold) {
      score += massActions.massBan.weight;
    }
    if (recentActivity.kicks >= massActions.massKick.threshold) {
      score += massActions.massKick.weight;
    }
    if (recentActivity.roleDeletes >= massActions.massRoleDelete.threshold) {
      score += massActions.massRoleDelete.weight;
    }
    if (recentActivity.channelDeletes >= massActions.massChannelDelete.threshold) {
      score += massActions.massChannelDelete.weight;
    }
    if (recentActivity.webhooks >= massActions.massWebhook.threshold) {
      score += massActions.massWebhook.weight;
    }

    const simultaneousActivity = [
      recentActivity.newJoins > 5,
      recentActivity.deletedMessages > 10,
      recentActivity.roleChanges > 3,
      recentActivity.channelCreations > 2,
      recentActivity.bans > 3,
      recentActivity.kicks > 3,
      recentActivity.webhooks > 2
    ].filter(Boolean).length;

    if (simultaneousActivity >= 4) score += 0.4;
    else if (simultaneousActivity >= 3) score += 0.3;
    else if (simultaneousActivity >= 2) score += 0.15;

    return Math.min(score, 1);
  }

  
detectFalsePositive(context, score) {
  const { guild, event, recentActivity, userProfile, executor } = context;
  
  
  if (event.type === 'massChannelDelete' && 
      recentActivity.channelDeletes === 3 &&
      !recentActivity.newJoins && 
      !recentActivity.bans &&
      !recentActivity.kicks) {
    return true;
  }
  
  
  if (event.type === 'massRoleDelete' && 
      recentActivity.roleDeletes === 3 &&
      !recentActivity.newJoins && 
      !recentActivity.bans &&
      !recentActivity.kicks) {
    return true;
  }
  
  
  
  if (event.type === 'massiveDeletion' && 
      recentActivity.deletedMessages >= 20 && 
      recentActivity.deletedMessages <= 60 &&  
      !recentActivity.newJoins && 
      !recentActivity.bans &&
      !recentActivity.channelDeletes &&
      !recentActivity.roleDeletes) {
    return true;
  }
  
  
  if (event.type === 'massiveDeletion' && 
      recentActivity.deletedMessages >= 20 && 
      recentActivity.deletedMessages <= 60) {
    
    const suspiciousActivityCount = [
      recentActivity.newJoins > 3,
      recentActivity.bans > 2,
      recentActivity.kicks > 2,
      recentActivity.channelDeletes > 1,
      recentActivity.roleDeletes > 1,
      recentActivity.webhooks > 2
    ].filter(Boolean).length;
    
    if (suspiciousActivityCount <= 1) {
      this.log('verbose', `✅ FP: Modération progressive détectée (${recentActivity.deletedMessages} msgs)`);
      return true;
    }
  }
  
  
  if (executor && this.isTrustedModerator(guild.id, executor.id)) {
    this.log('verbose', `✅ FP: Action par modérateur de confiance (${executor.tag})`);
    return true;
  }
  
  
  const velocity = this.calculateActionVelocity(recentActivity);
  if (velocity.isHumanLike && !recentActivity.newJoins) {
    this.log('verbose', `✅ FP: Vélocité humaine détectée (${velocity.velocity.toFixed(3)} act/sec)`);
    return true;
  }

  const guildFP = this.falsePositiveMemory.get(guild.id) || [];
  const signature = this.createEventSignature(context);
  
  for (const fp of guildFP) {
    if (this.calculatePatternSimilarity(signature, fp.signature) > 0.92) {
      this.log('verbose', `🔍 Faux positif historique: ${event.type}`);
      return true;
    }
  }

  return false;
}

  
  calculateActionVelocity(recentActivity) {
    const window = this.config.analysisWindow / 1000;
    
    const deletionsPerSec = (recentActivity.deletedMessages || 0) / window;
    const bansPerSec = (recentActivity.bans || 0) / window;
    const kicksPerSec = (recentActivity.kicks || 0) / window;
    
    const totalVelocity = deletionsPerSec + bansPerSec + kicksPerSec;
    
    return {
      velocity: totalVelocity,
      isHumanLike: totalVelocity < 0.15,
      isSuspicious: totalVelocity > 0.5
    };
  }

  
  updateModeratorTrust(guildId, executorId, wasFalsePositive) {
    if (!executorId) return;
    
    if (!this.moderatorActions.has(executorId)) {
      this.moderatorActions.set(executorId, {
        actions: 0,
        falsePositives: 0
      });
    }
    
    const modStats = this.moderatorActions.get(executorId);
    modStats.actions++;
    
    if (wasFalsePositive) {
      modStats.falsePositives++;
    }
    
    if (modStats.actions >= 10) {
      const fpRate = modStats.falsePositives / modStats.actions;
      
      if (fpRate < 0.2) {
        if (!this.trustedModerators.has(guildId)) {
          this.trustedModerators.set(guildId, new Set());
        }
        this.trustedModerators.get(guildId).add(executorId);
        this.log('verbose', `✅ Modérateur de confiance: ${executorId} (${modStats.actions} actions, ${Math.round(fpRate*100)}% FP)`);
      }
    }
  }

  isTrustedModerator(guildId, executorId) {
    if (!executorId) return false;
    return this.trustedModerators.get(guildId)?.has(executorId) || false;
  }

  analyzePatterns(context) {
    const signature = this.createEventSignature(context);
    let maxPatternScore = 0;

    for (const [patternId, pattern] of this.knownPatterns) {
      const similarity = this.calculatePatternSimilarity(signature, pattern);
      if (similarity > 0.7) {
        maxPatternScore = Math.max(maxPatternScore, pattern.confidence * similarity);
      }
    }

    return maxPatternScore;
  }

  calculateCoordination(recentActivity) {
    const timestamps = recentActivity.joinTimestamps || [];
    if (timestamps.length < 2) return { variance: Infinity, coordinated: false };

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((acc, interval) => 
      acc + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    return {
      variance,
      coordinated: variance < 15000,
      avgInterval
    };
  }

  isSuspiciousUsername(username) {
    if (!username) return false;
    
    const suspiciousPatterns = [
      /^user\d{4,}$/i,
      /^[a-z]{1,3}\d{4,}$/i,
      /^.*(raid|spam|bot|nuke|destroy).*$/i,
      /^[0-9]{4,}$/,
      /^[a-z]{10,}$/i,
      /(.)\1{4,}/
    ];

    return suspiciousPatterns.some(pattern => pattern.test(username));
  }

createEventSignature(context) {
    return {
      joinRate: Math.min((context.recentActivity.newJoins || 0) / 10, 1),
      accountAgeRatio: context.userProfile ? 
        Math.min((Date.now() - context.userProfile.createdTimestamp) / (7 * 24 * 60 * 60 * 1000), 1) : 0.5,
      timeOfDay: new Date().getHours() / 24,
      serverSize: Math.min(context.guild.memberCount / 1000, 1),
      activityIntensity: this.calculateActivityIntensity(context.recentActivity),
      massActionScore: this.calculateMassActionScore(context.recentActivity)
    };
  }

  calculateActivityIntensity(activity) {
    const totalActivity = (activity.newJoins || 0) + 
                         (activity.deletedMessages || 0) + 
                         (activity.roleChanges || 0) + 
                         (activity.bans || 0) +
                         (activity.kicks || 0) +
                         (activity.channelDeletes || 0) +
                         (activity.roleDeletes || 0) +
                         (activity.webhooks || 0);
    return Math.min(totalActivity / 50, 1);
  }

  calculateMassActionScore(activity) {
    let score = 0;
    score += Math.min((activity.bans || 0) / 10, 0.3);
    score += Math.min((activity.kicks || 0) / 10, 0.3);
    score += Math.min((activity.channelDeletes || 0) / 5, 0.2);
    score += Math.min((activity.roleDeletes || 0) / 5, 0.2);
    return Math.min(score, 1);
  }

  calculatePatternSimilarity(signature1, signature2) {
    const keys = Object.keys(signature1);
    let similarity = 0;

    keys.forEach(key => {
      const diff = Math.abs(signature1[key] - (signature2[key] || 0));
      similarity += (1 - diff) / keys.length;
    });

    return Math.max(0, similarity);
  }

  calculateAdaptiveMultiplier(guildProfile, context) {
    let multiplier = 1;

    const totalEvents = guildProfile.raidHistory + guildProfile.falseAlerts;
    
    if (totalEvents < 15) {
      return 1;
    }

    if (guildProfile.raidHistory > guildProfile.falseAlerts * 2) {
      multiplier += 0.15;
    } else if (guildProfile.falseAlerts > guildProfile.raidHistory * 5) {
      multiplier -= 0.10;
    }

    if (context.guild.memberCount > 10000) {
      multiplier += 0.1;
    } else if (context.guild.memberCount < 100) {
      multiplier -= 0.05;
    }

    return Math.max(0.7, Math.min(1.4, multiplier));
  }

  calculateAdaptiveThreshold(guildData) {
    const baseThreshold = this.config.baseThreshold;
    
    if (!guildData.incidents && !guildData.falsePositives) {
      return baseThreshold;
    }

    const total = guildData.incidents + guildData.falsePositives;
    
    if (total < 25) {
      return baseThreshold;
    }
    
    const accuracy = guildData.incidents / total;

    if (accuracy > 0.85) return baseThreshold - 0.05;
    if (accuracy < 0.15) return baseThreshold + 0.08;
    
    return baseThreshold;
  }

  calculateConfidence(guildProfile, score) {
    let confidence = 0.7;

    const totalEvents = guildProfile.raidHistory + guildProfile.falseAlerts;
    if (totalEvents > 10) confidence += 0.2;
    else if (totalEvents > 3) confidence += 0.1;

    if (guildProfile.falseAlerts > guildProfile.raidHistory * 2) {
      confidence -= 0.3;
    }

    if (score > 0.9 || score < 0.1) confidence += 0.1;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  identifySpecificThreats(context, score) {
    const threats = [];
    const { recentActivity, userProfile } = context;

    if (recentActivity.newJoins >= 15) {
      threats.push(`🌊 Arrivée massive détectée (${recentActivity.newJoins} nouveaux membres)`);
    }

    if (userProfile && Date.now() - userProfile.createdTimestamp < 24 * 60 * 60 * 1000) {
      threats.push('👶 Comptes très récents (< 24h)');
    }

    const coordination = this.calculateCoordination(recentActivity);
    if (coordination.coordinated) {
      threats.push(`🎯 Actions hautement coordonnées (variance: ${Math.round(coordination.variance/1000)}s)`);
    }

    if (recentActivity.deletedMessages > 20) {
      threats.push(`🗑️ Suppression massive de messages (${recentActivity.deletedMessages})`);
    }

    if (recentActivity.roleChanges > 5) {
      threats.push(`⚡ Modifications de rôles suspectes (${recentActivity.roleChanges})`);
    }

    if (recentActivity.bans >= 5) {
      threats.push(`🔨 Bannissements massifs détectés (${recentActivity.bans})`);
    }

    if (recentActivity.kicks >= 5) {
      threats.push(`👢 Expulsions massives détectées (${recentActivity.kicks})`);
    }

    if (recentActivity.channelDeletes >= 3) {
      threats.push(`📢 Suppression massive de salons (${recentActivity.channelDeletes})`);
    }

    if (recentActivity.roleDeletes >= 3) {
      threats.push(`🎭 Suppression massive de rôles (${recentActivity.roleDeletes})`);
    }

    if (recentActivity.webhooks >= 4) {
      threats.push(`🔗 Création suspecte de webhooks (${recentActivity.webhooks})`);
    }

    const hour = new Date().getHours();
    if ((hour >= 2 && hour <= 6) && recentActivity.newJoins > 5) {
      threats.push('🌙 Activité suspecte en heures creuses');
    }

    if (threats.length === 0 && score > 0.4) {
      threats.push('🤖 Pattern suspect détecté par analyse comportementale');
    }

    return threats;
  }

  generateIntelligentReasoning(context, score, threats, isFalsePositive) {
    const percentage = Math.round(score * 100);
    let reasoning = '';

    if (isFalsePositive) {
      reasoning = `✅ FAUX POSITIF DÉTECTÉ (${percentage}%) - Activité légitime identifiée. `;
    } else if (score >= 0.8) {
      reasoning = `🚨 ALERTE CRITIQUE (${percentage}%) - Raid probable en cours. `;
    } else if (score >= 0.6) {
      reasoning = `⚠️ ALERTE ÉLEVÉE (${percentage}%) - Activité très suspecte détectée. `;
    } else if (score >= 0.4) {
      reasoning = `🔸 SURVEILLANCE RENFORCÉE (${percentage}%) - Comportement inhabituel. `;
    } else {
      reasoning = `ℹ️ ACTIVITÉ NORMALE (${percentage}%) - Pas de menace détectée. `;
    }

    const factors = [];
    if (context.recentActivity.newJoins > 8) factors.push(`${context.recentActivity.newJoins} nouveaux membres`);
    if (context.recentActivity.bans > 3) factors.push(`${context.recentActivity.bans} bans`);
    if (context.recentActivity.kicks > 3) factors.push(`${context.recentActivity.kicks} kicks`);
    if (context.recentActivity.channelDeletes > 2) factors.push(`${context.recentActivity.channelDeletes} salons supprimés`);
    if (context.recentActivity.roleDeletes > 2) factors.push(`${context.recentActivity.roleDeletes} rôles supprimés`);
    if (context.userProfile && Date.now() - context.userProfile.createdTimestamp < 7 * 24 * 60 * 60 * 1000) {
      factors.push('comptes récents');
    }
    if (this.calculateCoordination(context.recentActivity).coordinated) {
      factors.push('actions coordonnées');
    }

    if (factors.length > 0) {
      reasoning += `Facteurs: ${factors.join(', ')}. `;
    }

    const guildProfile = this.guildProfiles.get(context.guild.id);
    if (guildProfile && guildProfile.raidHistory > 0) {
      reasoning += `Serveur avec historique de raids (${guildProfile.raidHistory} incidents).`;
    }

    return reasoning;
  }

  createGuildProfile(guildId) {
    const profile = {
      raidHistory: 0,
      falseAlerts: 0,
      adaptiveThreshold: this.config.baseThreshold,
      lastUpdate: Date.now(),
      createdAt: Date.now()
    };
    
    this.guildProfiles.set(guildId, profile);
    return profile;
  }

  async learnFromEvent(guildId, wasActualThreat, context, analysis) {
    const guildProfile = this.guildProfiles.get(guildId) || this.createGuildProfile(guildId);
    
    if (wasActualThreat) {
      guildProfile.raidHistory++;
      this.metrics.confirmedThreats++;
      
      const signature = this.createEventSignature(context);
      const patternId = this.generatePatternId(signature);
      
      if (this.knownPatterns.has(patternId)) {
        const pattern = this.knownPatterns.get(patternId);
        pattern.occurrences++;
        pattern.confidence = Math.min(0.95, pattern.confidence + 0.05);
      } else {
        if (this.knownPatterns.size >= this.config.maxPatterns) {
          this.pruneOldPatterns();
        }
        
        this.knownPatterns.set(patternId, {
          ...signature,
          confidence: 0.7,
          occurrences: 1,
          type: 'confirmed_threat'
        });
      }
    } else {
      guildProfile.falseAlerts++;
      
      const signature = this.createEventSignature(context);
      const guildFP = this.falsePositiveMemory.get(guildId) || [];
      guildFP.push({
        signature,
        timestamp: Date.now(),
        eventType: context.event.type
      });
      
      if (guildFP.length > 50) {
        guildFP.shift();
      }
      this.falsePositiveMemory.set(guildId, guildFP);
      
      guildProfile.adaptiveThreshold = Math.min(0.75, guildProfile.adaptiveThreshold + 0.03);
    }
    
    guildProfile.lastUpdate = Date.now();
    
    
    if (context.executor) {
      this.updateModeratorTrust(guildId, context.executor.id, !wasActualThreat);
    }
    
    if (Math.random() < 0.05) {
      await this.saveSystemData(true);
    }

    this.log('verbose', `📚 Apprentissage: ${guildId} - Threat: ${wasActualThreat}, Historique: ${guildProfile.raidHistory}/${guildProfile.falseAlerts}`);
  }

  generatePatternId(signature) {
    return Object.values(signature)
      .map(v => Math.round(v * 10))
      .join('');
  }

  generateSmartAlert(guild, analysis, triggerEvent) {
    const { threatLevel, confidence, threats, reasoning, isFalsePositive } = analysis;
    
    let alertLevel, color, emoji;
    if (isFalsePositive) {
      alertLevel = 'FAUX POSITIF';
      color = 0x00FF00;
      emoji = '✅';
    } else if (threatLevel >= 0.8) {
      alertLevel = 'CRITIQUE';
      color = 0xFF0000;
      emoji = '🚨';
    } else if (threatLevel >= 0.6) {
      alertLevel = 'ÉLEVÉ';
      color = 0xFF4400;
      emoji = '⚠️';
    } else if (threatLevel >= 0.4) {
      alertLevel = 'MODÉRÉ';
      color = 0xFFAA00;
      emoji = '🔸';
    } else {
      alertLevel = 'INFO';
      color = 0x4488FF;
      emoji = 'ℹ️';
    }

    const guildProfile = this.guildProfiles.get(guild.id);
    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ANTI-RAID INTELLIGENT • ${alertLevel}`)
      .setColor(color)
      .setDescription(
        `**🎯 Événement :** ${triggerEvent}\n` +
        `**🛡️ Score de Risque :** ${Math.round(threatLevel * 100)}%\n` +
        `**🎯 Confiance :** ${Math.round(confidence * 100)}%\n` +
        `**📊 Profil Serveur :** ${guildProfile ? guildProfile.raidHistory : 0} raids • ${guildProfile ? guildProfile.falseAlerts : 0} faux positifs`
      )
      .addFields(
        {
          name: '🚩 Menaces Identifiées',
          value: threats.length > 0 
            ? threats.slice(0, 5).map(t => `• ${t}`).join('\n').substring(0, 1000)
            : '• Aucune menace majeure détectée',
          inline: false
        },
        {
          name: '🧠 Analyse Intelligente',
          value: reasoning.substring(0, 500) + (reasoning.length > 500 ? '...' : ''),
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: `Anti-Raid v2.4 • Serveur: ${guild.name}` });

    return embed;
  }

  recordActivity(guild, activityType, data) {
    const guildId = guild.id;
    
    if (!this.guildAnalytics.has(guildId)) {
      this.guildAnalytics.set(guildId, {
        newJoins: 0,
        deletedMessages: 0,
        roleChanges: 0,
        channelCreations: 0,
        channelDeletes: 0,
        roleDeletes: 0,
        bans: 0,
        kicks: 0,
        webhooks: 0,
        joinTimestamps: [],
        suspiciousUsers: new Set(),
        accountAges: [],
        avgAccountAge: 0,
        lastReset: Date.now()
      });
    }

    const analytics = this.guildAnalytics.get(guildId);
    
    switch (activityType) {
      case 'joins':
        analytics.newJoins++;
        if (analytics.joinTimestamps.length >= this.config.maxTimestamps) {
          analytics.joinTimestamps.shift();
        }
        analytics.joinTimestamps.push(data.timestamp);
        
        if (data.accountAge) {
          if (analytics.accountAges.length >= this.config.maxAccountAges) {
            analytics.accountAges.shift();
          }
          analytics.accountAges.push(data.accountAge);
          analytics.avgAccountAge = analytics.accountAges.reduce((a, b) => a + b, 0) / analytics.accountAges.length;
        }
        
        if (data.suspicious) {
          if (analytics.suspiciousUsers.size >= this.config.maxSuspiciousUsers) {
            const usersArray = Array.from(analytics.suspiciousUsers);
            analytics.suspiciousUsers.clear();
            const keepCount = Math.floor(this.config.maxSuspiciousUsers * 0.7);
            usersArray.slice(-keepCount).forEach(id => analytics.suspiciousUsers.add(id));
          }
          analytics.suspiciousUsers.add(data.userId);
        }
        break;
        
      case 'deletedMessages':
        analytics.deletedMessages++;
        break;
        
      case 'roleChanges':
        analytics.roleChanges++;
        break;
        
      case 'channelCreations':
        analytics.channelCreations++;
        break;
        
      case 'channelDeletes':
        analytics.channelDeletes++;
        break;
        
      case 'roleDeletes':
        analytics.roleDeletes++;
        break;
        
      case 'bans':
        analytics.bans++;
        break;
        
      case 'kicks':
        analytics.kicks++;
        break;
        
      case 'webhooks':
        analytics.webhooks++;
        break;
    }
  }

  getRecentActivity(guild) {
    const analytics = this.guildAnalytics.get(guild.id);
    
    if (!analytics) {
      return {
        newJoins: 0,
        deletedMessages: 0,
        roleChanges: 0,
        channelCreations: 0,
        channelDeletes: 0,
        roleDeletes: 0,
        bans: 0,
        kicks: 0,
        webhooks: 0,
        joinTimestamps: [],
        avgAccountAge: 0
      };
    }

    const now = Date.now();
    if (now - analytics.lastReset > this.config.analysisWindow) {
      const filteredTimestamps = analytics.joinTimestamps.filter(
        t => now - t < this.config.analysisWindow
      );
      
      return {
        newJoins: filteredTimestamps.length,
        deletedMessages: analytics.deletedMessages,
        roleChanges: analytics.roleChanges,
        channelCreations: analytics.channelCreations,
        channelDeletes: analytics.channelDeletes,
        roleDeletes: analytics.roleDeletes,
        bans: analytics.bans,
        kicks: analytics.kicks,
        webhooks: analytics.webhooks,
        joinTimestamps: filteredTimestamps,
        avgAccountAge: analytics.avgAccountAge
      };
    }

    return analytics;
  }

  async saveSystemData(silent = false) {
    if (this.saveLock) {
      if (!silent) this.log('verbose', '⏳ Sauvegarde en cours, skip...');
      return;
    }

    this.saveLock = true;
    
    try {
      const systemData = {
        version: '2.4',
        lastSave: Date.now(),
        intelligentSystem: {
          guildProfiles: Object.fromEntries(this.guildProfiles),
          knownPatterns: Object.fromEntries(
            Array.from(this.knownPatterns.entries()).slice(0, this.config.maxPatterns)
          ),
          falsePositiveMemory: Object.fromEntries(this.falsePositiveMemory)
        },
        metrics: this.metrics
      };

      await fs.writeFile(
        this.AI_CONFIG_PATH,
        JSON.stringify(systemData, null, 2),
        'utf8'
      );

      this.logCounters.saves++;
      if (!silent) {
        this.log('essential', `💾 Sauvegarde #${this.logCounters.saves} réussie`);
      }
    } catch (error) {
      this.log('essential', '❌ Erreur sauvegarde:', error.message);
    } finally {
      this.saveLock = false;
    }
  }

  generateConsolidatedReport() {
    const totalGuilds = this.guildProfiles.size;
    const totalPatterns = this.knownPatterns.size;
    const totalFPMemory = Array.from(this.falsePositiveMemory.values())
      .reduce((sum, arr) => sum + arr.length, 0);

    let totalRaids = 0;
    let totalFalseAlerts = 0;

    for (const profile of this.guildProfiles.values()) {
      totalRaids += profile.raidHistory;
      totalFalseAlerts += profile.falseAlerts;
    }

    const accuracy = totalRaids + totalFalseAlerts > 0
      ? Math.round((totalRaids / (totalRaids + totalFalseAlerts)) * 100)
      : 0;

    return {
      guilds: totalGuilds,
      patterns: totalPatterns,
      falsePositiveMemory: totalFPMemory,
      raids: totalRaids,
      falseAlerts: totalFalseAlerts,
      accuracy: `${accuracy}%`,
      totalAnalyses: this.metrics.totalAnalyses,
      totalAlerts: this.metrics.totalAlerts,
      confirmedThreats: this.metrics.confirmedThreats
    };
  }
}





const intelligentAntiRaid = new IntelligentAntiRaid();

module.exports = async (client) => {
  
  client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      const canAnalyze = await intelligentAntiRaid.throttleAnalysis(guild.id);
      if (!canAnalyze) return;

      const accountAge = Date.now() - member.user.createdTimestamp;
      const isSuspicious = !member.user.avatar || 
                          intelligentAntiRaid.isSuspiciousUsername(member.user.username) ||
                          accountAge < 7 * 24 * 60 * 60 * 1000;

      intelligentAntiRaid.recordActivity(guild, 'joins', {
        userId: member.user.id,
        timestamp: Date.now(),
        accountAge,
        suspicious: isSuspicious
      });

      const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
      
      if (recentActivity.newJoins >= 5) {
        const context = {
          guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount
          },
          event: {
            type: 'suspiciousJoins',
            description: `${recentActivity.newJoins} nouveaux membres en ${intelligentAntiRaid.config.analysisWindow / 60000} minutes`
          },
          recentActivity,
          userProfile: {
            username: member.user.username,
            createdTimestamp: member.user.createdTimestamp,
            hasAvatar: !!member.user.avatar,
            isBot: member.user.bot
          },
          executor: null
        };

        const analysis = intelligentAntiRaid.analyzeEvent(context);
        
        if (analysis.isFalsePositive) {
          await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
        } else if (analysis.threatLevel >= 0.8) {
          await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
        }
        
        if (analysis.threatLevel >= 0.5) {
          const cooldownKey = `${guild.id}_join`;
          const lastAlert = intelligentAntiRaid.alertCooldowns.get(cooldownKey);
          const now = Date.now();

          if (!lastAlert || (now - lastAlert) > intelligentAntiRaid.config.cooldownPeriod) {
            intelligentAntiRaid.alertCooldowns.set(cooldownKey, now);

            try {
              const logConfig = await getLoggingConfig(guild.id);
              
              let logChannel;
              if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Raid détecté mais pas de canal logs`) };
              } else {
                logChannel = guild.channels.cache.get(logConfig.logChannelId);
                if (!logChannel || typeof logChannel.send !== 'function') {
                  logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
                }
              }
              
              const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
                `🌊 ${recentActivity.newJoins} nouveaux membres détectés`
              );
              await logChannel.send({ embeds: [alert] });
              
            } catch (logErr) {
              intelligentAntiRaid.log('essential', `❌ Erreur envoi alerte pour ${guild.name}: ${logErr.message}`);
            }
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', '❌ Erreur analyse membre:', err.message);
    }
  });

  
client.on('messageDelete', async (message) => {
  if (!message.guild) return;
  const guild = message.guild;
  
  try {
    const config = await loadAntiRaidConfig();
    const guildConfig = config[guild.id];
    if (!guildConfig || !guildConfig.aiAnalyzer) return;

    intelligentAntiRaid.recordActivity(guild, 'deletedMessages', {
      channelId: message.channel.id,
      timestamp: Date.now()
    });

    const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
    
    
    if (recentActivity.deletedMessages >= 35) {
      let executor = null;
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MessageDelete,
          limit: 1,
        });
        const deleteLog = logs.entries.first();
        if (deleteLog && (Date.now() - deleteLog.createdTimestamp) < 5000) {
          executor = deleteLog.executor;
        }
      } catch (auditErr) {
        intelligentAntiRaid.log('verbose', `Audit logs indisponibles pour ${guild.name}`);
      }

      if (executor && executor.bot) {
        return;
      }

      const context = {
        guild: {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount
        },
        event: {
          type: 'massiveDeletion',
          description: `${recentActivity.deletedMessages} messages supprimés`
        },
        recentActivity,
        userProfile: executor ? {
          username: executor.username,
          createdTimestamp: executor.createdTimestamp,
          hasAvatar: !!executor.avatar,
          isBot: executor.bot
        } : null,
        executor: executor 
      };

      const analysis = intelligentAntiRaid.analyzeEvent(context);
      analysis.threatLevel = Math.min(1, analysis.threatLevel + 0.2);
      
      if (analysis.isFalsePositive) {
        await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
      } else if (analysis.threatLevel >= 0.8) {
        await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
      }
      
      if (analysis.threatLevel >= 0.6) {
        const cooldownKey = `${guild.id}_delete`;
        const lastAlert = intelligentAntiRaid.alertCooldowns.get(cooldownKey);
        const now = Date.now();

        if (!lastAlert || (now - lastAlert) > intelligentAntiRaid.config.cooldownPeriod) {
          intelligentAntiRaid.alertCooldowns.set(cooldownKey, now);

          try {
            const logConfig = await getLoggingConfig(guild.id);
            
            let logChannel;
            if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
              logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Suppression massive détectée`) };
            } else {
              logChannel = guild.channels.cache.get(logConfig.logChannelId);
              if (!logChannel || typeof logChannel.send !== 'function') {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
              }
            }
            
            const executorText = executor ? ` par ${executor.tag}` : '';
            const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
              `🗑️ Suppression massive: ${recentActivity.deletedMessages} messages${executorText}`
            );
            await logChannel.send({ embeds: [alert] });
            
          } catch (logErr) {
            intelligentAntiRaid.log('essential', `❌ Erreur logs suppression pour ${guild.name}: ${logErr.message}`);
          }
        }
      }
    }

  } catch (err) {
    intelligentAntiRaid.log('essential', '❌ Erreur analyse suppression:', err.message);
  }
});

  
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const guild = newMember.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        
        let executor = null;
        try {
          const logs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberRoleUpdate,
            limit: 1,
          });
          const roleLog = logs.entries.first();
          if (roleLog && roleLog.target.id === newMember.user.id && 
              (Date.now() - roleLog.createdTimestamp) < 5000) {
            executor = roleLog.executor;
          }
        } catch (auditErr) {
          intelligentAntiRaid.log('verbose', `Audit logs indisponibles pour ${guild.name}`);
        }

        if (executor && executor.bot) {
          return;
        }

        intelligentAntiRaid.recordActivity(guild, 'roleChanges', {
          userId: newMember.user.id,
          timestamp: Date.now()
        });

        const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
        
        
        if (recentActivity.roleChanges >= 15) {
          const context = {
            guild: {
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount
            },
            event: {
              type: 'massRoleChanges',
              description: `${recentActivity.roleChanges} modifications de rôles`
            },
            recentActivity,
            userProfile: executor ? {
              username: executor.username,
              createdTimestamp: executor.createdTimestamp,
              hasAvatar: !!executor.avatar,
              isBot: executor.bot
            } : null,
            executor: executor
          };

          const analysis = intelligentAntiRaid.analyzeEvent(context);
          
          if (analysis.isFalsePositive) {
            await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
          } else if (analysis.threatLevel >= 0.8) {
            await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
          }
          
          if (analysis.threatLevel >= 0.5) {
            const cooldownKey = `${guild.id}_roles`;
            const lastAlert = intelligentAntiRaid.alertCooldowns.get(cooldownKey);
            const now = Date.now();

            if (!lastAlert || (now - lastAlert) > intelligentAntiRaid.config.cooldownPeriod) {
              intelligentAntiRaid.alertCooldowns.set(cooldownKey, now);

              try {
                const logConfig = await getLoggingConfig(guild.id);
                
                let logChannel;
                if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
                  logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Modifications rôles massives détectées`) };
                } else {
                  logChannel = guild.channels.cache.get(logConfig.logChannelId);
                  if (!logChannel || typeof logChannel.send !== 'function') {
                    logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
                  }
                }
                
                const executorText = executor ? ` par ${executor.tag}` : '';
                const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
                  `⚡ Modifications massives: ${recentActivity.roleChanges} rôles${executorText}`
                );
                await logChannel.send({ embeds: [alert] });
                
              } catch (logErr) {
                intelligentAntiRaid.log('essential', `❌ Erreur logs rôles pour ${guild.name}: ${logErr.message}`);
              }
            }
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', '❌ Erreur analyse update membre:', err.message);
    }
  });

  client.on('guildBanAdd', async (ban) => {
    const guild = ban.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      intelligentAntiRaid.recordActivity(guild, 'bans', {
        userId: ban.user.id,
        timestamp: Date.now()
      });

      const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
      
      if (recentActivity.bans >= 5) {
        let executor;
        try {
          const logs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanAdd,
            limit: 1,
          });
          executor = logs.entries.first()?.executor;
        } catch (auditErr) {
          intelligentAntiRaid.log('verbose', `Audit logs indisponibles pour ${guild.name}`);
        }

        if (executor && executor.bot) {
          return;
        }

        const context = {
          guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount
          },
          event: {
            type: 'massBan',
            description: `Bannissements massifs (${recentActivity.bans})`
          },
          recentActivity,
          userProfile: executor ? {
            username: executor.username,
            createdTimestamp: executor.createdTimestamp,
            hasAvatar: !!executor.avatar,
            isBot: executor.bot
          } : null,
          executor: executor
        };

        const analysis = intelligentAntiRaid.analyzeEvent(context);
        
        if (analysis.isFalsePositive) {
          await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
        } else if (analysis.threatLevel >= 0.8) {
          await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
        }
        
        if (analysis.threatLevel >= 0.6) {
          try {
            const logConfig = await getLoggingConfig(guild.id);
            
            let logChannel;
            if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
              logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Mass ban détecté`) };
            } else {
              logChannel = guild.channels.cache.get(logConfig.logChannelId);
              if (!logChannel || typeof logChannel.send !== 'function') {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
              }
            }
            
            const executorText = executor ? ` par ${executor.tag}` : '';
            const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
              `🔨 Mass Ban: ${recentActivity.bans} bannissements${executorText}`
            );
            await logChannel.send({ embeds: [alert] });
            
          } catch (logErr) {
            intelligentAntiRaid.log('essential', `❌ Erreur logs ban pour ${guild.name}: ${logErr.message}`);
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', '❌ Erreur analyse ban:', err.message);
    }
  });

  client.on('guildMemberRemove', async (member) => {
    const guild = member.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      let wasKick = false;
      let executor = null;
      
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberKick,
          limit: 1,
        });
        const kickLog = logs.entries.first();
        if (kickLog && kickLog.target.id === member.user.id && 
            (Date.now() - kickLog.createdTimestamp) < 5000) {
          wasKick = true;
          executor = kickLog.executor;
        }
      } catch (auditErr) {
        intelligentAntiRaid.log('verbose', `Audit logs indisponibles pour ${guild.name}`);
      }

      if (wasKick && executor && executor.bot) {
        return;
      }

      if (wasKick) {
        intelligentAntiRaid.recordActivity(guild, 'kicks', {
          userId: member.user.id,
          timestamp: Date.now()
        });

        const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
        
        if (recentActivity.kicks >= 5) {
          const context = {
            guild: {
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount
            },
            event: {
              type: 'massKick',
              description: `Expulsions massives (${recentActivity.kicks})`
            },
            recentActivity,
            userProfile: executor ? {
              username: executor.username,
              createdTimestamp: executor.createdTimestamp,
              hasAvatar: !!executor.avatar,
              isBot: executor.bot
            } : null,
            executor: executor
          };

          const analysis = intelligentAntiRaid.analyzeEvent(context);
          
          if (analysis.isFalsePositive) {
            await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
          } else if (analysis.threatLevel >= 0.8) {
            await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
          }
          
          if (analysis.threatLevel >= 0.6) {
            try {
              const logConfig = await getLoggingConfig(guild.id);
              
              let logChannel;
              if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Mass kick détecté`) };
              } else {
                logChannel = guild.channels.cache.get(logConfig.logChannelId);
                if (!logChannel || typeof logChannel.send !== 'function') {
                  logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
                }
              }
              
              const executorText = executor ? ` par ${executor.tag}` : '';
              const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
                `👢 Mass Kick: ${recentActivity.kicks} expulsions${executorText}`
              );
              await logChannel.send({ embeds: [alert] });
              
            } catch (logErr) {
              intelligentAntiRaid.log('essential', `❌ Erreur logs kick pour ${guild.name}: ${logErr.message}`);
            }
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', '❌ Erreur analyse kick:', err.message);
    }
  });

  client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const guild = channel.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      intelligentAntiRaid.recordActivity(guild, 'channelCreations', {
        channelId: channel.id,
        channelName: channel.name,
        type: channel.type
      });

      const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
      
      if (recentActivity.channelCreations >= 3) {
        const context = {
          guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount
          },
          event: {
            type: 'massiveChannelCreation',
            description: `Création massive de canaux`
          },
          recentActivity,
          userProfile: null,
          executor: null
        };

        const analysis = intelligentAntiRaid.analyzeEvent(context);
        analysis.threatLevel = Math.min(1, analysis.threatLevel + 0.3);
        
        if (analysis.isFalsePositive) {
          await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
        } else if (analysis.threatLevel >= 0.8) {
          await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
        }
        
        if (analysis.threatLevel >= 0.5) {
          try {
            const logConfig = await getLoggingConfig(guild.id);
            
            let logChannel;
            if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
              logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Création massive canaux détectée`) };
            } else {
              logChannel = guild.channels.cache.get(logConfig.logChannelId);
              if (!logChannel || typeof logChannel.send !== 'function') {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
              }
            }
            
            const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
              `Création massive de canaux (${recentActivity.channelCreations} canaux)`
            );
            await logChannel.send({ embeds: [alert] });
            
          } catch (logErr) {
            intelligentAntiRaid.log('essential', `❌ Erreur logs canaux pour ${guild.name}: ${logErr.message}`);
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', '❌ Erreur analyse création canal:', err.message);
    }
  });

  client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const guild = channel.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      intelligentAntiRaid.recordActivity(guild, 'channelDeletes', {
        channelId: channel.id,
        channelName: channel.name,
        type: channel.type
      });

      const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
      
      if (recentActivity.channelDeletes >= 3) {
        let executor;
        try {
          const logs = await guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelDelete,
            limit: 1,
          });
          executor = logs.entries.first()?.executor;
        } catch (auditErr) {
          intelligentAntiRaid.log('verbose', `Audit logs indisponibles pour ${guild.name}`);
        }

        if (executor && executor.bot) {
          return;
        }

        const context = {
          guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount
          },
          event: {
            type: 'massChannelDelete',
            description: `Suppression massive de salons (${recentActivity.channelDeletes})`
          },
          recentActivity,
          userProfile: executor ? {
            username: executor.username,
            createdTimestamp: executor.createdTimestamp,
            hasAvatar: !!executor.avatar,
            isBot: executor.bot
          } : null,
          executor: executor
        };

        const analysis = intelligentAntiRaid.analyzeEvent(context);
        
        if (analysis.isFalsePositive) {
          await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
        } else if (analysis.threatLevel >= 0.8) {
          await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
        }
        
        if (analysis.threatLevel >= 0.6) {
          try {
            const logConfig = await getLoggingConfig(guild.id);
            
            let logChannel;
            if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
              logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Suppression massive salons détectée`) };
            } else {
              logChannel = guild.channels.cache.get(logConfig.logChannelId);
              if (!logChannel || typeof logChannel.send !== 'function') {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
              }
            }
            
            const executorText = executor ? ` par ${executor.tag}` : '';
            const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
              `📢 Suppression massive: ${recentActivity.channelDeletes} salons${executorText}`
            );
            await logChannel.send({ embeds: [alert] });
            
          } catch (logErr) {
            intelligentAntiRaid.log('essential', `Erreur logs suppression salons pour ${guild.name}: ${logErr.message}`);
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', 'Erreur analyse suppression salon:', err);
    }
  });

  client.on('roleDelete', async (role) => {
    const guild = role.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      intelligentAntiRaid.recordActivity(guild, 'roleDeletes', {
        roleId: role.id,
        roleName: role.name
      });

      const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
      
      if (recentActivity.roleDeletes >= 3) {
        let executor;
        try {
          const logs = await guild.fetchAuditLogs({
            type: AuditLogEvent.RoleDelete,
            limit: 1,
          });
          executor = logs.entries.first()?.executor;
        } catch (auditErr) {
          
        }

        if (executor && executor.bot) {
          return;
        }

        const context = {
          guild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount
          },
          event: {
            type: 'massRoleDelete',
            description: `Suppression massive de rôles (${recentActivity.roleDeletes})`
          },
          recentActivity,
          userProfile: executor ? {
            username: executor.username,
            createdTimestamp: executor.createdTimestamp,
            hasAvatar: !!executor.avatar,
            isBot: executor.bot
          } : null,
          executor: executor
        };

        const analysis = intelligentAntiRaid.analyzeEvent(context);
        
        if (analysis.isFalsePositive) {
          await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
        } else if (analysis.threatLevel >= 0.8) {
          await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
        }
        
        if (analysis.threatLevel >= 0.6) {
          try {
            const logConfig = await getLoggingConfig(guild.id);
            
            let logChannel;
            if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
              logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Suppression massive rôles détectée`) };
            } else {
              logChannel = guild.channels.cache.get(logConfig.logChannelId);
              if (!logChannel || typeof logChannel.send !== 'function') {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
              }
            }
            
            const executorText = executor ? ` par ${executor.tag}` : '';
            const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
              `🎭 Suppression massive: ${recentActivity.roleDeletes} rôles${executorText}`
            );
            await logChannel.send({ embeds: [alert] });
            
          } catch (logErr) {
            intelligentAntiRaid.log('essential', `Erreur logs suppression rôles pour ${guild.name}: ${logErr.message}`);
          }
        }
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', 'Erreur analyse suppression rôle:', err);
    }
  });
  client.on('webhookUpdate', async (channel) => {
    if (!channel.guild) return;
    const guild = channel.guild;
    
    try {
      const config = await loadAntiRaidConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.aiAnalyzer) return;

      try {
        const webhooks = await channel.fetchWebhooks();
        
        intelligentAntiRaid.recordActivity(guild, 'webhooks', {
          channelId: channel.id,
          channelName: channel.name,
          webhookCount: webhooks.size
        });

        const recentActivity = intelligentAntiRaid.getRecentActivity(guild);
        
        if (recentActivity.webhooks >= 4) {
          let executor;
          try {
            const logs = await guild.fetchAuditLogs({
              type: AuditLogEvent.WebhookCreate,
              limit: 1,
            });
            executor = logs.entries.first()?.executor;
          } catch (auditErr) {
            
          }

          if (executor && executor.bot) {
            return;
          }

          const context = {
            guild: {
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount
            },
            event: {
              type: 'massWebhookCreate',
              description: `Création massive de webhooks (${recentActivity.webhooks})`
            },
            recentActivity,
            userProfile: executor ? {
              username: executor.username,
              createdTimestamp: executor.createdTimestamp,
              hasAvatar: !!executor.avatar,
              isBot: executor.bot
            } : null,
            executor: executor
          };

          const analysis = intelligentAntiRaid.analyzeEvent(context);
          
          if (analysis.isFalsePositive) {
            await intelligentAntiRaid.learnFromEvent(guild.id, false, context, analysis);
          } else if (analysis.threatLevel >= 0.8) {
            await intelligentAntiRaid.learnFromEvent(guild.id, true, context, analysis);
          }
          
          if (analysis.threatLevel >= 0.5) {
            try {
              const logConfig = await getLoggingConfig(guild.id);
              
              let logChannel;
              if (!logConfig || !logConfig.enabled || !logConfig.logChannelId) {
                logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Création massive webhooks détectée`) };
              } else {
                logChannel = guild.channels.cache.get(logConfig.logChannelId);
                if (!logChannel || typeof logChannel.send !== 'function') {
                  logChannel = { send: (msg) => intelligentAntiRaid.log('essential', `[${guild.name}] Canal logs introuvable`) };
                }
              }
              
              const executorText = executor ? ` par ${executor.tag}` : '';
              const alert = intelligentAntiRaid.generateSmartAlert(guild, analysis, 
                `🔗 Création suspecte: ${recentActivity.webhooks} webhooks${executorText}`
              );
              await logChannel.send({ embeds: [alert] });
              
            } catch (logErr) {
              intelligentAntiRaid.log('essential', `Erreur logs webhooks pour ${guild.name}: ${logErr.message}`);
            }
          }
        }
      } catch (webhookErr) {
        
      }

    } catch (err) {
      intelligentAntiRaid.log('essential', 'Erreur analyse webhook:', err);
    }
  });

  
  
  
  setInterval(async () => {
    const now = Date.now();
    const maxAge = intelligentAntiRaid.config.memoryWindow;
    
    
    for (const [key, timestamp] of intelligentAntiRaid.alertCooldowns.entries()) {
      if (now > timestamp + maxAge) {
        intelligentAntiRaid.alertCooldowns.delete(key);
      }
    }
    
    
    for (const [guildId, analytics] of intelligentAntiRaid.guildAnalytics.entries()) {
      if (now - analytics.lastReset > maxAge) {
        intelligentAntiRaid.guildAnalytics.delete(guildId);
      }
    }
    
    
    for (const [guildId, fpList] of intelligentAntiRaid.falsePositiveMemory.entries()) {
      const filtered = fpList.filter(fp => now - fp.timestamp < 7 * 24 * 60 * 60 * 1000);
      if (filtered.length === 0) {
        intelligentAntiRaid.falsePositiveMemory.delete(guildId);
      } else if (filtered.length !== fpList.length) {
        intelligentAntiRaid.falsePositiveMemory.set(guildId, filtered);
      }
    }

    
    for (const [guildId, analytics] of intelligentAntiRaid.guildAnalytics.entries()) {  
      if (analytics.suspiciousUsers.size > intelligentAntiRaid.config.maxSuspiciousUsers) {  
        const usersArray = Array.from(analytics.suspiciousUsers);
        analytics.suspiciousUsers.clear();
        const keepCount = Math.floor(intelligentAntiRaid.config.maxSuspiciousUsers * 0.7);
        usersArray.slice(-keepCount).forEach(id => analytics.suspiciousUsers.add(id));
      }
    }
    
    
    for (const [guildId, analytics] of intelligentAntiRaid.guildAnalytics.entries()) {
      if (analytics.joinTimestamps && analytics.joinTimestamps.length > 0) {
        const cutoff = now - intelligentAntiRaid.config.analysisWindow;
        const oldLength = analytics.joinTimestamps.length;
        analytics.joinTimestamps = analytics.joinTimestamps.filter(t => t > cutoff);
        
        if (oldLength !== analytics.joinTimestamps.length) {
          intelligentAntiRaid.log('verbose', `🧹 Nettoyage timestamps ${guildId}: ${oldLength} → ${analytics.joinTimestamps.length}`);
        }
      }
    }

    
    const queueCutoff = now - (5 * 60 * 1000);
    let cleanedQueue = 0;
    for (const [guildId, timestamp] of intelligentAntiRaid.processingQueue.entries()) {
      if (timestamp < queueCutoff) {
        intelligentAntiRaid.processingQueue.delete(guildId);
        cleanedQueue++;
      }
    }
    if (cleanedQueue > 0) {
      intelligentAntiRaid.log('verbose', `🧹 Nettoyage processingQueue: ${cleanedQueue} entrées`);
    }

    
    let cleanedAnalytics = 0;
    for (const [guildId, analytics] of intelligentAntiRaid.guildAnalytics.entries()) {
      const hasActivity = 
        analytics.newJoins > 0 ||
        analytics.deletedMessages > 0 ||
        analytics.roleChanges > 0 ||
        analytics.bans > 0 ||
        analytics.kicks > 0 ||
        analytics.channelDeletes > 0 ||
        analytics.roleDeletes > 0 ||
        analytics.webhooks > 0;
      
      const isOld = (now - analytics.lastReset) > (2 * 60 * 60 * 1000);
      
      if (!hasActivity && isOld) {
        intelligentAntiRaid.guildAnalytics.delete(guildId);
        cleanedAnalytics++;
      }
    }
    if (cleanedAnalytics > 0) {
      intelligentAntiRaid.log('verbose', `🧹 Nettoyage analytics: ${cleanedAnalytics} serveurs`);
    }
    
    
    if (intelligentAntiRaid.knownPatterns.size > intelligentAntiRaid.config.maxPatterns * 1.2) {
      intelligentAntiRaid.pruneOldPatterns();
    }
    
    
    if (intelligentAntiRaid.guildProfiles.size > 0) {
      await intelligentAntiRaid.saveSystemData(true);
    }
    
    intelligentAntiRaid.logCounters.maintenance++;
    if (intelligentAntiRaid.logCounters.maintenance % intelligentAntiRaid.config.maintenanceLogInterval === 0) {
      const report = intelligentAntiRaid.generateConsolidatedReport();
      intelligentAntiRaid.log('essential', `🛡️ Maintenance #${intelligentAntiRaid.logCounters.maintenance}:`, report);
    }
  }, 20 * 60 * 1000);

  setInterval(() => {
    intelligentAntiRaid.logCounters.reports++;
    
    if (intelligentAntiRaid.logCounters.reports % 4 === 0) {
      const report = intelligentAntiRaid.generateConsolidatedReport();
      intelligentAntiRaid.log('essential', '📊 Rapport Anti-Raid Intelligent:', report);
    }
  }, 2 * 60 * 60 * 1000);

  setInterval(async () => {
    try {
      await intelligentAntiRaid.saveSystemData(true);
    } catch (err) {
      intelligentAntiRaid.log('essential', 'Erreur sauvegarde automatique:', err);
    }
  }, 45 * 60 * 1000);

  setInterval(() => {
    let optimizationsCount = 0;
    
    for (const [guildId, profile] of intelligentAntiRaid.guildProfiles.entries()) {
      const total = profile.raidHistory + profile.falseAlerts;
      if (total >= 10) {
        const accuracy = profile.raidHistory / total;
        
        if (accuracy > 0.9 && profile.adaptiveThreshold > 0.3) {
          profile.adaptiveThreshold -= 0.05;
          optimizationsCount++;
        } else if (accuracy < 0.5 && profile.adaptiveThreshold < 0.9) {
          profile.adaptiveThreshold += 0.05;
          optimizationsCount++;
        }
        
        profile.adaptiveThreshold = Math.max(0.2, Math.min(0.95, profile.adaptiveThreshold));
      }
    }
    
    if (optimizationsCount > 0) {
      intelligentAntiRaid.log('essential', `🎓 Auto-optimisation: ${optimizationsCount} seuils ajustés`);
    }
  }, 60 * 60 * 1000);

  intelligentAntiRaid.log('essential', 
    '🛡️ Anti-Raid v2.4 initialisé | ' +
    'Détections: ban/kick/channels/roles/webhooks | ' +
    'Faux positifs: ✓ | Apprentissage adaptatif: ✓ | ' +
    '🤖 Filtrage bots: ACTIF | ' +
    '🆕 Niveaux 1+2+3: ACTIFS'
  );
};