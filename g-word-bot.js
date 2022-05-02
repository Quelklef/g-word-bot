const fs = require('fs');
const { Telegraf } = require('telegraf');

function getToken() {
  if (process.env.G_WORD_BOT_TOKEN)
    return process.env.G_WORD_BOT_TOKEN;
  throw Error('Missing Telegram token. Please set G_WORD_BOT_TOKEN. (maybe try again in a nix-shell)')
}

const bot = new Telegraf(getToken());

// database master 😎
// nb. Since I deploy with nixops, this is absolutely terrible
//     state management. Luckily, I don't care that much
function withState(fun) {
  const floc = './state.json';
  if (!fs.existsSync(floc))
    fs.writeFileSync(floc, '{}');
  let state = JSON.parse(fs.readFileSync(floc));
  fun(state);
  fs.writeFileSync(floc, JSON.stringify(state, null, 2));
}

function getCurrentState() {
  let result;
  withState(state => result = state);  // state monad be like
  return result;
}

bot.on('text', ctx => {

  const text = ctx.update.message.text;
  const hasGWord = /(\W|^)good(\W|$)/gi.test(text);

  if (hasGWord) {
    ctx.reply('No using the g-word!', { reply_to_message_id: ctx.update.message.message_id });
  }

  else if (text === 'g-word stats') {
    const chatId = ctx.update.message.chat.id;
    const state = getCurrentState();
    const response = (
      Object.entries(state.counts[chatId] ?? {})
      .map(([userId, { gWordCount, messageCount }]) => {
        const userName = state.users[userId].displayName;
        return `${userName}: ${gWordCount} violations in ${messageCount} messages`;
      }).join('\n')
    );
    ctx.reply(response, { reply_to_message_id: ctx.update.message.message_id });
  }

  // Update statistics
  withState(state => {
    const fromUserId = ctx.update.message.from.id;
    const fromUserName = ctx.update.message.from.username;
    const chatId = ctx.update.message.chat.id;

    state.counts ??= {};
    state.counts[chatId] ??= {};
    state.counts[chatId][fromUserId] ??= {};
    state.counts[chatId][fromUserId].messageCount ??= 0;
    state.counts[chatId][fromUserId].gWordCount ??= 0;
    state.counts[chatId][fromUserId].messageCount += 1;
    state.counts[chatId][fromUserId].gWordCount += (hasGWord ? 1 : 0);

    state.users ??= {};
    state.users[fromUserId] ??= {};
    state.users[fromUserId].displayName = fromUserName;
  });

});

bot.launch();
