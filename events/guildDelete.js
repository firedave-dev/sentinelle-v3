const { deleteAntiRaidConfig, hasAntiRaidConfig } = require('../core/antiraidStorage');

module.exports = {
  name: 'guildDelete',
  once: false,
  async execute(guild) {
    if (!guild?.id) {
      console.error('❌ [GUILD DELETE] Guild invalide reçue');
      return;
    }

    const guildId = guild.id;
    const guildName = guild.name || 'Nom inconnu';
    
    console.log(`\n🔥 [CONFIG CLEANUP] Nettoyage pour ${guildName} (${guildId})`);
    
    try {
      console.log(`🔍 Vérification de l'existence de la config...`);
      
      const hasConfig = await hasAntiRaidConfig(guildId);
      
      if (hasConfig) {
        console.log(`🎯 Configuration trouvée pour ${guildId}, suppression...`);
        
        const success = await deleteAntiRaidConfig(guildId);
        
        if (success) {
          console.log(`✅ Configuration supprimée avec succès pour ${guildName}`);
          
          const stillExists = await hasAntiRaidConfig(guildId);
          if (stillExists) {
            console.log(`❌ ATTENTION: La config est encore là après suppression !`);
          } else {
            console.log(`✅ Suppression confirmée - Config vraiment supprimée`);
          }
        } else {
          console.log(`❌ Échec de la suppression via deleteAntiRaidConfig`);
        }
      } else {
        console.log(`ℹ️ Aucune configuration trouvée pour ${guildName} (${guildId})`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du nettoyage de config pour ${guildName}:`, error);
    }
  }
};