const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/captchaConfig.json');
const erreurUtilisateurs = new Map();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('captcha-')) return;

    const { guild, member, customId } = interaction;
    if (!guild) return;

    if (!fs.existsSync(configPath)) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Configuration captcha introuvable.',
          ephemeral: true,
        });
      }
      return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const guildConfig = config[guild.id];
    if (!guildConfig) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Aucune configuration captcha pour ce serveur.',
          ephemeral: true,
        });
      }
      return;
    }

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const key = `${guild.id}-${member.id}`;

      if (customId === 'captcha-correct') {
        if (!guild.members.me.permissions.has('ManageRoles')) {
          if (!interaction.replied) {
            return interaction.editReply("❌ Je n'ai pas la permission de gérer les rôles.");
          }
          return;
        }

        const botHighestRole = guild.members.me.roles.highest;
        const roleToAdd = guild.roles.cache.get(guildConfig.roleId);
        if (!roleToAdd) {
          if (!interaction.replied) {
            return interaction.editReply("❌ Le rôle de vérification n'existe plus.");
          }
          return;
        }
        if (roleToAdd.position >= botHighestRole.position) {
          if (!interaction.replied) {
            return interaction.editReply("❌ Je ne peux pas attribuer ce rôle car il est au-dessus de mon rôle.");
          }
          return;
        }

        if (member.roles.cache.has(guildConfig.roleId)) {
          if (!interaction.replied) {
            return interaction.editReply('✅ Tu as déjà le rôle.');
          }
          return;
        }

        try {
          await member.roles.add(guildConfig.roleId);
        } catch (error) {
          if (!interaction.replied) {
            if (error.code === 50013) {
              return interaction.editReply("❌ Je n'ai pas la permission d'ajouter ce rôle.");
            }
            console.error('Erreur lors de l\'ajout du rôle:', error);
            return interaction.editReply("❌ Une erreur est survenue lors de l'attribution du rôle.");
          }
          return;
        }

        if (!interaction.replied) {
          return interaction.editReply('✅ Vérification réussie ! Accès accordé.');
        }
      } else {
        
        const erreurs = erreurUtilisateurs.get(key) || 0;
        const nouvellesErreurs = erreurs + 1;

        if (nouvellesErreurs >= 2) {
          try {
            await member.send('❌ Tu as échoué à la vérification et as été expulsé.');
          } catch (_) {}

          if (!guild.members.me.permissions.has('KickMembers')) {
            if (!interaction.replied) {
              return interaction.editReply("❌ Je n'ai pas la permission d'expulser ce membre.");
            }
            return;
          }
          if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
            if (!interaction.replied) {
              return interaction.editReply("❌ Je ne peux pas expulser ce membre car son rôle est égal ou supérieur au mien.");
            }
            return;
          }

          try {
            await member.kick('Échec captcha (2 erreurs)');
          } catch (error) {
            if (!interaction.replied) {
              if (error.code === 50013) {
                return interaction.editReply("❌ Je n'ai pas la permission de l'expulser (erreur Discord).");
              }
              console.error('Erreur lors du kick:', error);
              return interaction.editReply("❌ Une erreur est survenue lors de l'expulsion.");
            }
            return;
          }

          erreurUtilisateurs.delete(key);

          if (!interaction.replied) {
            return interaction.editReply('❌ Tu as fait trop d’erreurs, tu as été expulsé.');
          }
        } else {
          erreurUtilisateurs.set(key, nouvellesErreurs);
          if (!interaction.replied) {
            return interaction.editReply(`🔍 Mauvais bouton. Il te reste **${2 - nouvellesErreurs} tentative(s)**.`);
          }
        }
      }
    } catch (err) {
      console.error('Erreur interactionCreate:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
      }
    }
  }
};
