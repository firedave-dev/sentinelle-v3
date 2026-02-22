const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder, ComponentType } = require('discord.js');
const { getWhitelistData } = require('../../core/whitelistManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('white-list')
        .setDescription('Gérer la liste blanche de l\'Anti-Raid.'),

    async execute(interaction) {

        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ 
                content: '❌ **Accès refusé** : Seul le propriétaire de ce serveur peut gérer la Whitelist.', 
                ephemeral: true 
            });
        }

        const data = await getWhitelistData();
        const wlArray = data[interaction.guild.id] || [];
        
        // Formater l'affichage des utilisateurs whitelists actuels
        let wlDisplay = wlArray.length > 0 
            ? wlArray.map(id => `<@${id}>`).join(', ') 
            : 'Aucun membre dans la liste blanche (sauf vous).';

        const embed = new EmbedBuilder()
            .setTitle('🔰 Gestion de la Whitelist Anti-Raid')
            .setDescription(`Les membres de cette liste sont totalement ignorés par le système anti-raid.\n\n**Membres actuels :**\n${wlDisplay}`)
            .setColor(0x251230) // Code couleur 2428016 converti en HEX
            .setFooter({ text: 'Sélectionnez un utilisateur ci-dessous pour l\'ajouter ou le retirer.' });

        // Utilisation du UserSelectMenuBuilder natif (Type 5)
        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('whitelist_manage_menu')
                .setPlaceholder('Choisir un membre à ajouter / retirer')
                .setMinValues(1)
                .setMaxValues(1)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};