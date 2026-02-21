const { AuditLogEvent } = require('discord.js');
const { addWhitelist, removeWhitelist, isWhitelisted } = require('../core/whitelistManager');

module.exports = (client) => {

    // 1. GESTION DU MENU DÉROULANT DE LA WHITELIST
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isUserSelectMenu()) return;
        if (interaction.customId !== 'whitelist_manage_menu') return;

        // Double vérification de sécurité
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "❌ Seul le propriétaire peut faire cela.", ephemeral: true });
        }

        const targetId = interaction.values[0];
        
        // Empêcher l'owner de se whitelister/unwhitelister lui-même (il est immunisé par défaut)
        if (targetId === interaction.guild.ownerId) {
            return interaction.reply({ content: "ℹ️ Vous êtes le propriétaire du serveur, vous êtes **déjà** et **toujours** dans la liste blanche.", ephemeral: true });
        }

        // Vérifier si l'utilisateur est déjà dans la whitelist pour l'ajouter ou le retirer
        const alreadyWhitelisted = await isWhitelisted(interaction.guild.id, targetId);

        if (alreadyWhitelisted) {
            await removeWhitelist(interaction.guild.id, targetId);
            await interaction.reply({ content: `✅ <@${targetId}> a été **retiré** de la whitelist.`, ephemeral: true });
        } else {
            await addWhitelist(interaction.guild.id, targetId);
            await interaction.reply({ content: `✅ <@${targetId}> a été **ajouté** à la whitelist. Ses actions ne déclencheront plus l'anti-raid.`, ephemeral: true });
        }
    });

    // 2. AJOUT AUTOMATIQUE À L'ARRIVÉE DU BOT (guildCreate)
    client.on('guildCreate', async (guild) => {
        // Ajouter le propriétaire
        await addWhitelist(guild.id, guild.ownerId);

        try {
            // Chercher qui a ajouté le bot via les logs d'audit
            const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 });
            const entry = logs.entries.first();

            // Si le log correspond bien à l'ajout de notre propre bot
            if (entry && entry.target?.id === client.user.id) {
                const executorId = entry.executor.id;
                // Si la personne qui a ajouté le bot n'est pas le propriétaire, on l'ajoute à la whitelist
                if (executorId !== guild.ownerId) {
                    await addWhitelist(guild.id, executorId);
                }
            }
        } catch (err) {
            console.log(`[Whitelist] Impossible de récupérer l'auteur de l'ajout pour ${guild.name}. Seul le propriétaire sera whitelisted.`);
        }
    });

    // 3. GESTION DU TRANSFERT DE PROPRIÉTÉ (guildUpdate)
    client.on('guildUpdate', async (oldGuild, newGuild) => {
        if (oldGuild.ownerId !== newGuild.ownerId) {
            // Le serveur a changé de propriétaire. On ajoute automatiquement le nouveau à la WL
            await addWhitelist(newGuild.id, newGuild.ownerId);
            console.log(`[Whitelist] Changement de propriétaire détecté sur ${newGuild.name}. Le nouveau propriétaire a été ajouté à la liste blanche.`);
        }
    });
};