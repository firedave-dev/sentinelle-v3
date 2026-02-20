const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const os = require('os');
const moment = require('moment');
require('moment-duration-format');


const nodeVersion = process.version;
const discordJsVersion = require('discord.js').version;
const packageJson = require('../../package.json'); 
const botVersion = packageJson.version;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot-info')
    .setDescription('Affiche les informations du bot.'),

  async execute(interaction) {
    await interaction.deferReply();

    const client = interaction.client;

    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount ?? 0), 0);

    const allChannels = client.channels.cache;
    const textChannels = allChannels.filter(c => c.type === 0).size;
    const voiceChannels = allChannels.filter(c => c.type === 2).size;
    const categories = allChannels.filter(c => c.type === 4).size;
    const forums = allChannels.filter(c => c.type === 15).size;

    const roles = client.guilds.cache.reduce((acc, guild) => acc + (guild.roles?.cache?.size ?? 0), 0);

    const uptime = moment.duration(client.uptime).humanize();
    const cpuCores = os.cpus().length;
    const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(0);
    const usedRAM = (process.memoryUsage().rss / 1024 / 1024 / 1024).toFixed(2);

    const gatewayPing = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🛡️・Sentinelle')
      .setColor('#5865F2')
      .setThumbnail('https://cdn.discordapp.com/attachments/1362448219958939751/1376281039198224595/logo5_17_171957.png')
      .addFields(
        {
          name: '💻・__Système__',
          value:
            `> ❤️ **Cœurs** : ${cpuCores}\n` +
            `> 💾 **RAM** : **${usedRAM}**/**${totalRAM}** GB\n` +
            `> ⏱️ **Uptime** : **${uptime}**\n` +
            `> 🛜 **Ping** : ${gatewayPing} ms`,
          inline: true
        },
        {
          name: '🌐・__Discord__',
          value:
            `> 🌐 **Serveurs** : **${totalGuilds}**\n` +
            `> 📂 **Catégories** : **${categories}**\n` +
            `> 💬 **Textuels** : **${textChannels}**\n` +
            `> 📁 **Forums** : **${forums}**\n` +
            `> 🔊 **Vocaux** : **${voiceChannels}**\n` +
            `> 👥 **Utilisateurs** : **${totalUsers.toLocaleString()}**\n` +
            `> 📚 **Rôles** : **${roles.toLocaleString()}**`,
          inline: true
        },
        {
          name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          value: '『 [Support](https://discord.gg/vpnw6VECPR) ・ [Inviter](https://discord.com/oauth2/authorize?client_id=1361781325874331780&permissions=277083450689&scope=bot+applications.commands) 』',
          inline: false
        },
        {
          name: '⚙️・__Technique__',
          value:
            `> <:dev:1420059109159600291> | 👑 **Créateur** : <@827635465044017172> \`zeta8276\`\n` +
            `> <:dev:1420059109159600291> **Développeur** : <@978294590073352213> \`fire_dave\`\n` +
            `> ⚙️ **Version** : **1.0.5.1**\n` +
            `> 🗓️ **Créé le** : 15/04/2025\n` +
            `> 💻 **Langage** : JavaScript\n` +
            `> 📦 **Node.js** : **${nodeVersion}**\n` +
            `> 📧 **discord.js** : **v${discordJsVersion}**\n` +
            `> 🔧 **Base de données** : ████████`,
          inline: false
        },
        {
          name: '🕒・__Dernière mise à jour__',
          value: `> ${moment(packageJson.date || Date.now()).format('DD/MM/YYYY')}`,
          inline: false
        }
      )
      .setImage('https://cdn.discordapp.com/attachments/1362448219958939751/1376281039198224595/logo5_17_171957.png')
      .setFooter({ text: 'Sentinelle • Merci de votre confiance !' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Rejoindre le support !')
        .setStyle(ButtonStyle.Link)
        .setEmoji('<:discordstaff:1420059868185755678>')
        .setURL('https://discord.gg/vpnw6VECPR'),
      new ButtonBuilder()
        .setLabel('Inviter Sentinelle')
        .setStyle(ButtonStyle.Link)
        .setEmoji('<:automod:1420059707556495470>')
        .setURL('https://discord.com/oauth2/authorize?client_id=1361781325874331780&permissions=277083450689&scope=bot+applications.commands')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
