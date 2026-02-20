const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');


const configPath = path.join(__dirname, '../../data/captchaConfig.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('captcha-setup')
    .setDescription('Configurer le système de vérification captcha')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon où envoyer le captcha')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addRoleOption(option =>
      option.setName('rôle')
        .setDescription('Rôle à attribuer après validation')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const salon = interaction.options.getChannel('salon');
      const role = interaction.options.getRole('rôle');

      
      if (!salon.permissionsFor(interaction.client.user).has(['SendMessages', 'EmbedLinks', 'ViewChannel'])) {
        return await interaction.reply({ content: '❌ Je n’ai pas la permission d’envoyer des messages dans ce salon.', ephemeral: true });
      }

      
      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      config[interaction.guild.id] = {
        channelId: salon.id,
        roleId: role.id
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      
      const correctIndex = Math.floor(Math.random() * 6);
      const emojis = ['🔵', '🟠', '🔴', '🟣', '🔄', '🧩'];
      const rows = [new ActionRowBuilder(), new ActionRowBuilder()];

      for (let i = 0; i < 6; i++) {
        const isCorrect = i === correctIndex;
        const emoji = isCorrect ? '✅' : emojis[Math.floor(Math.random() * emojis.length)];

        const button = new ButtonBuilder()
          .setCustomId(isCorrect ? 'captcha-correct' : `captcha-wrong-${i}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emoji);

        const rowIndex = i < 3 ? 0 : 1;
        rows[rowIndex].addComponents(button);
      }

      
      const embed = new EmbedBuilder()
        .setTitle('<:automod:1420059707556495470>・Vérification Captcha')
        .setColor('#5865F2')
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setImage('https://cdn.discordapp.com/attachments/1362448219958939751/1376281039198224595/logo5_17_171957.png')
        .setDescription(`Bienvenue sur **${interaction.guild.name}** !\n\n> 🛡️ **Sécurité anti-bot activée**\n> \u200B\n> Pour accéder au serveur, tu dois réussir ce captcha.\n> **Tu as droit à 2 erreurs maximum, sinon tu seras expulsé automatiquement.**\n\n> 👤 **Rôle attribué après succès :** ${role}\n> 🔢 **Nombre d'essais autorisés :** 2\n\n> ℹ️ **Clique sur le bouton \`✅\` parmi les choix proposés ci-dessous.**`)
        .addFields(
          {
            name: 'Pourquoi ce captcha ?',
            value: 'Ce système protège le serveur contre les bots et les raids. Merci de ta compréhension !',
            inline: false
          }
        )
        .setFooter({ text: 'Sentinelle • Système de sécurité avancé', iconURL: interaction.client.user.displayAvatarURL() });

      await salon.send({ embeds: [embed], components: rows });
      await interaction.reply({ content: `✅ Captcha envoyé dans ${salon} !`, ephemeral: true });

    } catch (err) {
      console.error('❌ Erreur dans /captcha-setup :', err);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l’exécution de la commande.',
          ephemeral: true
        });
      }
    }
  }
};
