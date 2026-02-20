const fs = require('fs').promises;
const path = require('path');

const filePath = path.join(__dirname, '../data/antiraidConfig.json');
const DEFAULT_CONFIG = {
  channelManipulation: false,
  guildMemberAdd: false,
  messageCreate: false,
  roleDelete: false,
  aiAnalyzer: false,
  botAdd: false
};

let configCache = null;
let isWriting = false;
const writeQueue = [];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  
  isWriting = true;
  const { config, resolve, reject } = writeQueue.shift();
  
  try {
    const dir = path.dirname(filePath);
    if (!(await fileExists(dir))) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    configCache = { ...config };
    console.log('✅ | Fichier antiraidConfig.json sauvegardé avec succès');
    resolve();
  } catch (err) {
    console.error('❌ Erreur d\'écriture antiraidConfig.json :', err);
    configCache = null;
    reject(err);
  } finally {
    isWriting = false;
    setTimeout(() => processWriteQueue(), 10);
  }
}

async function loadAntiRaidConfig() {
  if (configCache) {
    return { ...configCache };
  }

  try {
    if (!(await fileExists(filePath))) {
      console.warn(`⚠️ Le fichier antiraidConfig.json n'existe pas, création d'une config vide.`);
      configCache = {};
      return {};
    }
    
    const data = await fs.readFile(filePath, 'utf8');
    if (!data.trim()) {
      configCache = {};
      return {};
    }
    
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Configuration invalide');
      }
      configCache = parsed;
      return { ...configCache };
    } catch (err) {
      console.error('⚠️ Erreur de format dans antiraidConfig.json :', err);
      configCache = {};
      return {};
    }
  } catch (err) {
    console.error('❌ Erreur de lecture antiraidConfig.json :', err);
    configCache = {};
    return {};
  }
}

async function saveAntiRaidConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration invalide fournie');
  }

  return new Promise((resolve, reject) => {
    writeQueue.push({ config: { ...config }, resolve, reject });
    processWriteQueue();
  });
}

async function deleteAntiRaidConfig(guildId) {
  if (!guildId || typeof guildId !== 'string') {
    console.error('❌ ID de guilde invalide fourni');
    return false;
  }

  try {
    console.log(`🔍 DEBUG: Tentative suppression guild ${guildId}`);
    
    if (!(await fileExists(filePath))) {
      console.log(`❌ Fichier antiraidConfig.json n'existe pas à: ${filePath}`);
      return false;
    }

    const allConfig = await loadAntiRaidConfig();
    
    if (Object.keys(allConfig).length === 0) {
      console.log(`ℹ️ Fichier de config vide`);
      return false;
    }

    if (!allConfig[guildId]) {
      console.log(`ℹ️ Guild ${guildId} pas trouvée dans le fichier`);
      return false;
    }

    console.log(`🎯 Guild ${guildId} trouvée ! Suppression...`);
    const updatedConfig = { ...allConfig };
    delete updatedConfig[guildId];
    
    await saveAntiRaidConfig(updatedConfig);
    console.log(`✅ Configuration anti-raid supprimée pour la guilde ${guildId}`);
    
    const verif = await loadAntiRaidConfig();
    if (verif[guildId]) {
      console.log(`❌ ERREUR: Guild encore présente après suppression !`);
      configCache = null;
      return false;
    } else {
      console.log(`✅ VÉRIFICATION OK: Guild vraiment supprimée`);
      return true;
    }
  } catch (err) {
    console.error('❌ Erreur lors de la suppression de la config anti-raid :', err);
    configCache = null;
    return false;
  }
}

async function getAntiRaidConfig(guildId, createIfMissing = true) {
  if (!guildId || typeof guildId !== 'string') {
    console.error('❌ ID de guilde invalide fourni à getAntiRaidConfig');
    return null;
  }

  const allConfig = await loadAntiRaidConfig();
  
  if (!allConfig[guildId] && !createIfMissing) {
    return null;
  }
  
  if (!allConfig[guildId] && createIfMissing) {
    const newConfig = { ...allConfig };
    newConfig[guildId] = { ...DEFAULT_CONFIG };
    await saveAntiRaidConfig(newConfig);
    return { ...DEFAULT_CONFIG };
  }
  
  return { ...allConfig[guildId] };
}

async function hasAntiRaidConfig(guildId) {
  if (!guildId || typeof guildId !== 'string') {
    return false;
  }
  
  const allConfig = await loadAntiRaidConfig();
  return !!allConfig[guildId];
}

async function setAntiRaidOption(guildId, option, value) {
  if (!guildId || typeof guildId !== 'string') {
    throw new Error('ID de guilde invalide');
  }
  
  if (!option || typeof option !== 'string') {
    throw new Error('Option invalide');
  }

  if (!DEFAULT_CONFIG.hasOwnProperty(option)) {
    throw new Error(`Option non reconnue: ${option}`);
  }

  const allConfig = await loadAntiRaidConfig();
  
  if (!allConfig[guildId]) {
    allConfig[guildId] = { ...DEFAULT_CONFIG };
  }
  
  allConfig[guildId][option] = Boolean(value);
  await saveAntiRaidConfig(allConfig);
}

async function resetAntiRaidConfig(guildId) {
  if (!guildId || typeof guildId !== 'string') {
    throw new Error('ID de guilde invalide');
  }

  const allConfig = await loadAntiRaidConfig();
  allConfig[guildId] = { ...DEFAULT_CONFIG };
  await saveAntiRaidConfig(allConfig);
  console.log(`🔄 Configuration anti-raid réinitialisée pour la guilde : ${guildId}`);
}

module.exports = {
  loadAntiRaidConfig,
  saveAntiRaidConfig,
  getAntiRaidConfig,
  hasAntiRaidConfig,
  setAntiRaidOption,
  resetAntiRaidConfig,
  deleteAntiRaidConfig
};