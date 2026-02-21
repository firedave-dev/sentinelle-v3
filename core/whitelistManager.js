const fs = require('fs').promises;
const path = require('path');

const WL_PATH = path.join(__dirname, '../data/wl.json');

// Crée le fichier s'il n'existe pas
async function initWhitelistFile() {
    try {
        await fs.access(WL_PATH);
    } catch {
        await fs.writeFile(WL_PATH, JSON.stringify({}), 'utf8');
    }
}

async function getWhitelistData() {
    await initWhitelistFile();
    try {
        const data = await fs.readFile(WL_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("[Whitelist] Erreur de lecture du fichier:", err);
        return {};
    }
}

async function saveWhitelistData(data) {
    // Sauvegarde atomique avec .tmp pour la stabilité (évite la corruption)
    const tempPath = `${WL_PATH}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, WL_PATH);
}

async function isWhitelisted(guildId, userId) {
    const data = await getWhitelistData();
    if (!data[guildId]) return false;
    return data[guildId].includes(userId);
}

async function addWhitelist(guildId, userId) {
    const data = await getWhitelistData();
    if (!data[guildId]) data[guildId] = [];
    if (!data[guildId].includes(userId)) {
        data[guildId].push(userId);
        await saveWhitelistData(data);
        return true;
    }
    return false;
}

async function removeWhitelist(guildId, userId) {
    const data = await getWhitelistData();
    if (!data[guildId]) return false;
    
    const index = data[guildId].indexOf(userId);
    if (index > -1) {
        data[guildId].splice(index, 1);
        await saveWhitelistData(data);
        return true;
    }
    return false;
}

module.exports = {
    isWhitelisted,
    addWhitelist,
    removeWhitelist,
    getWhitelistData
};