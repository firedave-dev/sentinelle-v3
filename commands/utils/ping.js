const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Affiche la latence du bot, de l\'API Discord et de l\'utilisateur'),
  
  async execute(interaction) {
    const startTime = Date.now();
    
    
    const reply = await interaction.reply({ 
      content: '🏓 Calcul des latences...', 
      fetchReply: true 
    });
    
    const endTime = Date.now();
    
    
    const botLatency = endTime - startTime; 
    const apiLatency = interaction.client.ws.ping; 
    const userLatency = reply.createdTimestamp - interaction.createdTimestamp; 
    
    
    const getConnectionQuality = (ping) => {
      if (ping < 100) return { emoji: '🟢', text: 'Excellente', color: 0x00ff00 };
      if (ping < 200) return { emoji: '🟡', text: 'Bonne', color: 0xffff00 };
      if (ping < 300) return { emoji: '🟠', text: 'Moyenne', color: 0xff8800 };
      return { emoji: '🔴', text: 'Mauvaise', color: 0xff0000 };
    };
    
    const botQuality = getConnectionQuality(botLatency);
    const apiQuality = getConnectionQuality(apiLatency);
    const userQuality = getConnectionQuality(userLatency);
    
    
    const averageLatency = Math.round((botLatency + apiLatency + userLatency) / 3);
    const overallQuality = getConnectionQuality(averageLatency);
    
    const embed = new EmbedBuilder()
      .setTitle('🏓 Analyse des Latences')
      .setColor(overallQuality.color)
      .setDescription(`📊 **Latence moyenne:** ${overallQuality.emoji} **${averageLatency}ms**`)
      .addFields(
        {
          name: '⚡ Traitement Bot',
          value: `${botQuality.emoji} **${botLatency}ms**\n*Temps de réponse du bot*`,
          inline: true
        },
        {
          name: '🌐 API Discord',
          value: `${apiQuality.emoji} **${apiLatency}ms**\n*WebSocket vers Discord*`,
          inline: true
        },
        {
          name: '👤 Votre Connexion',
          value: `${userQuality.emoji} **${userLatency}ms**\n*Round-trip complet*`,
          inline: true
        }
      )
      .addFields({
        name: '📈 Détails Techniques',
        value: `\`\`\`yaml
Serveur Discord: ${interaction.guild ? interaction.guild.name : 'DM'}
Région: ${interaction.guild ? interaction.guild.preferredLocale : 'N/A'}
Shard: ${interaction.guild ? interaction.guild.shardId || 0 : 0}
Uptime: ${Math.floor(interaction.client.uptime / 1000 / 60)}min
\`\`\``,
        inline: false
      })
      .setFooter({ 
        text: `${interaction.user.tag} • ${new Date().toLocaleString('fr-FR')}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();
    
    await interaction.editReply({ content: null, embeds: [embed] });
  },
};