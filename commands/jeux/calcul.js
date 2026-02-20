const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calcul')
    .setDescription('Défie-toi avec un calcul mental contre le bot !'),

  async execute(interaction) {
    const operations = ['+', '-', '*', '/'];
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    
    const num1 = getRandomInt(1, 10);
    const num2 = getRandomInt(1, 10);
    const operation = operations[Math.floor(Math.random() * operations.length)];

    
    let correctAnswer;
    switch (operation) {
      case '+':
        correctAnswer = num1 + num2;
        break;
      case '-':
        correctAnswer = num1 - num2;
        break;
      case '*':
        correctAnswer = num1 * num2;
        break;
      case '/':
        if (num2 === 0) {
          correctAnswer = 'Erreur (division par zéro)';
        } else {
          correctAnswer = (num1 / num2).toFixed(2); 
        }
        break;
    }

    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle("Défi Calcul Mental")
      .setDescription(`Je vais te poser un calcul mental !\nQuel est le résultat de : **${num1} ${operation} ${num2}** ?`)
      .setFooter({ text: "Tu as 30 secondes pour répondre !" });

    
    await interaction.reply({ embeds: [embed] });

    
    const filter = response => response.author.id === interaction.user.id && !isNaN(response.content);
    const collector = interaction.channel.createMessageCollector({ filter, time: 30000 }); 

    collector.on('collect', (message) => {
      
      collector.stop();

      const userAnswer = parseFloat(message.content);
      let correctAnswerFloat = parseFloat(correctAnswer); 

      
      if (correctAnswerFloat % 1 !== 0) {
        correctAnswerFloat = parseFloat(correctAnswer).toFixed(2); 
      }

      
      if (Math.abs(userAnswer - correctAnswerFloat) < 0.01) {
        return message.reply(`Bravo ! La réponse est bien **${correctAnswer}**.`);
      } else {
        return message.reply(`Désolé, la réponse correcte était **${correctAnswer}**. Essaye encore !`);
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.followUp("Dommage, tu n'as pas répondu à temps !");
      }
    });
  }
};