const { Events, EmbedBuilder } = require('discord.js');
const getLogChannel = require('../logs/getLogChannel');

module.exports = {
  name: Events.GuildCreate,
  once: false,
  async execute(guild, client) {
    const embed = new EmbedBuilder()
      .setTitle('✅ Nouveau serveur rejoint !')
      .setColor('Green')
      .setDescription("Merci de m'avoir ajouté !\n\n**Pensez à activer l'antiraid et à placer mon rôle tout en haut de la hiérarchie.**")
      .setImage('https://cdn.discordapp.com/attachments/1362448219958939751/1376281039198224595/logo5_17_171957.png')
      .setTimestamp();

    const defaultChannel = guild.channels.cache.find(channel =>
      channel.isTextBased() && channel.permissionsFor(guild.members.me).has('SendMessages')
    );

    if (defaultChannel) defaultChannel.send({ embeds: [embed] }).catch(() => {});

    try {
      const logChannel = await getLogChannel(guild, client);
      if (logChannel) console.log(`✅ Salon logs créé : ${guild.name}`);
    } catch (err) {
      console.error(`❌ Erreur guildCreate : ${guild.name}`, err);
    }
  }
};