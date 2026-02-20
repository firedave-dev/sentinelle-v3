const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'help_select') return;

    let embed;

    switch (interaction.values[0]) {
      case 'menu':
        embed = new EmbedBuilder()
          .setTitle('🏠 Accueil')
          .setDescription('- Vous trouverez toutes les commandes du bot de la V1.0.5.\n- Assurez-vous de toujours placer le rôle du bot tout en haut.\n- **Quelques liens utiles :**')
          .addFields([
            {
              name: '🔗 Liens',
              value: '[✉️ Support](https://discord.gg/crQ9Qgzbck)\n[🤖  Top.gg](https://top.gg/fr/bot/1361781325874331780)'
            }
          ])
          .setColor('Blurple');
        break;

      case 'moderation':
        embed = new EmbedBuilder()
          .setTitle('🦺 Modération')
          .setDescription(
            '> /kick <utilisateur|id> [raison] – Expulser un membre\n\n' +
            '> /ban <utilisateur|id> [raison] – Bannir un membre\n\n' +
            '> /unban <id> [raison] – Débannir un membre\n\n' +
            '> /slowdown – Régler le délai entre les messages\n\n' +
            '> /scanserveur – Effectuer un scan de sécurité du serveur\n\n' +
            '> /captcha-setup – Activer un système de captcha\n\n' +
            '> /clear – Supprimer un nombre de messages'
          )
          .setColor('Green');
        break;

      case 'antiraid':
        embed = new EmbedBuilder()
          .setTitle('🛡️ Antiraid')
          .setDescription(
            '> /antiraid – Gérer les protections anti-raid du serveur\n' +
            '> Permet d’activer ou désactiver les différentes mesures automatiques de sécurité.\n\n' +
            '> **Comportement :**\n' +
            '> • Aucune sanction si l’utilisateur est hiérarchiquement au-dessus du bot\n' +
            '> • Les options peuvent être activées ou désactivées individuellement\n\n' +
            '> • Utilisez /antiraid pour configurer les protections.'
          )
          .setColor('Red');
        break;

      case 'logs':
        embed = new EmbedBuilder()
          .setTitle('💾 Logs')
          .setDescription(
            '> /logs – Gérer les logs du serveur\n' +
            '> Permet d’activer ou désactiver les logs automatiques des événements de modération.\n\n' +
            '> **Fonctionnement :**\n' +
            '> • Les événements (raid, suppression de salon, lien Discord...) sont envoyés dans le salon spécifié.\n' +
            '> • La configuration est enregistrée dans logSettings.json.\n' +
            '> • Le salon est identifié par **ID**, pas par nom — il peut donc être renommé sans effet.\n\n' +
            '> • Utilisez /logs pour choisir le salon, /logs OFF pour désactiver.'
          )
          .setColor('Blue');
        break;

      case 'utilitaire':
        embed = new EmbedBuilder()
          .setTitle('📦 Utilitaire')
          .setDescription(
            '> /ping – Latence du bot & de l’utilisateur\n\n' +
            '> /bot-info – Affiche les informations du bot\n\n' +
            '> /calcul – Lance un défi de calcul mental'
          )
          .setColor('Purple');
        break;

      default:
        embed = new EmbedBuilder()
          .setTitle('ℹ️ Catégorie inconnue')
          .setDescription('> La sélection ne correspond à aucune catégorie connue.')
          .setColor('DarkGrey');
        break;
    }

    try {
      await interaction.update({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de l’embed :', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la mise à jour.',
          ephemeral: true
        });
      }
    }
  });
};
