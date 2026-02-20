const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../logSettings.json');
let cachedSettings = null;


function loadSettings() {
  if (cachedSettings) return cachedSettings;

  try {
    if (!fs.existsSync(filePath)) {
      console.warn('[logSettingsManager] Fichier logSettings.json non trouvé, création...');
      cachedSettings = {};
      fs.writeFileSync(filePath, JSON.stringify(cachedSettings, null, 2));
      return cachedSettings;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    cachedSettings = JSON.parse(data);
    return cachedSettings;
  } catch (error) {
    console.error('[logSettingsManager] Erreur lors du chargement des paramètres :', error);
    return {};
  }
}


function saveSettings(settings) {
  try {
    cachedSettings = settings;
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('[logSettingsManager] ✅ Paramètres sauvegardés dans logSettings.json');
  } catch (error) {
    console.error('[logSettingsManager] ❌ Erreur lors de la sauvegarde des paramètres :', error);
  }
}


function setLogging(guildId, enabled, logChannelId = null) {
  console.log(`[logSettingsManager] setLogging -> guildId=${guildId}, enabled=${enabled}, logChannelId=${logChannelId}`);

  const settings = loadSettings();

  settings[guildId] = {
    enabled,
    logChannelId: enabled ? logChannelId : null,
  };

  saveSettings(settings);
}


function isLoggingEnabled(guildId) {
  const settings = loadSettings();
  return settings[guildId]?.enabled === true;
}


function getLoggingConfig(guildId) {
  const settings = loadSettings();
  return settings[guildId] || null;
}


function getLogChannelId(guildId) {
  const settings = loadSettings();
  return settings[guildId]?.logChannelId || null;
}


function removeLoggingConfig(guildId) {
  const settings = loadSettings();

  if (settings[guildId]) {
    delete settings[guildId];
    saveSettings(settings);
    console.log(`[logSettingsManager] 🗑️ Config supprimée pour la guilde ${guildId}`);
  } else {
    console.log(`[logSettingsManager] ⚠️ Aucune config à supprimer pour la guilde ${guildId}`);
  }
}

module.exports = {
  setLogging,
  isLoggingEnabled,
  getLoggingConfig,
  getLogChannelId,
  loadSettings,
  saveSettings,
  removeLoggingConfig 
};
