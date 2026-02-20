const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche le menu d’aide'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🏠 Accueil')
      .setDescription(
        '- Vous trouverez toutes les commandes du bot de la V1.0.5.\n' +
        '- Assurez-vous de toujours placer le rôle du bot tout en haut.\n' +
        '- **Quelques liens utiles :**'
      )
      .addFields(
        { 
          name: '🔗 Liens', 
          value: '[✉️ Support](https://discord.gg/crQ9Qgzbck)\n[🤖  Top.gg](https://top.gg/fr/bot/1361781325874331780)' 
        }
      )
      .setColor('Blurple')
      .setFooter({ text: 'Choisissez la catégorie recherchée dans le menu.' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Choisissez une catégorie')
      .addOptions(
        {
          label: 'Accueil',
          description: 'Retourner à l’accueil',
          value: 'menu',
          emoji: '🏠',
        },
        {
          label: 'Modération',
          description: 'Commandes modération',
          value: 'moderation',
          emoji: '🦺',
        },
        {
          label: 'Antiraid',
          description: 'Commande antiraid',
          value: 'antiraid',
          emoji: '🛡️',
        },
        {
          label: 'Logs',
          description: 'Commande logs',
          value: 'logs',
          emoji: '💾',
        },
        {
          label: 'Utilitaire',
          description: 'Commandes utilitaire',
          value: 'utilitaire',
          emoji: '📦',
        },
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};