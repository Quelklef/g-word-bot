const fs = require('fs');
const { Telegraf } = require('telegraf');

function getToken() {
  if (process.env.G_WORD_BOT_TOKEN)
    return process.env.G_WORD_BOT_TOKEN;
  if (fs.existsSync('./token'))
    return fs.readFileSync('./token');
  throw Error('Missing Telegram token. Please write one to ./token or set G_WORD_BOT_TOKEN.')
}

const bot = new Telegraf(getToken());

bot.on('text', ctx => {
  const text = ctx.update.message.text;
  if (text.includes('good'))
    ctx.reply('No using the g-word!', { reply_to_message_id: ctx.update.message.message_id });
});

bot.launch();
