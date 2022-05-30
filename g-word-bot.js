const fs = require('fs');
const { Telegraf } = require('telegraf');

function getToken() {
  if (process.env.G_WORD_BOT_TOKEN)
    return process.env.G_WORD_BOT_TOKEN;
  throw Error('Missing Telegram token. Please set G_WORD_BOT_TOKEN. (maybe try again in a nix-shell)')
}

const bot = new Telegraf(getToken());

const stateFileLoc = (
  process.env.G_WORD_BOT_STATEFILE_LOC
  || require('path').resolve(process.env.PWD, 'state.json')
);

console.log('Using statefile at', stateFileLoc);

function withState(fun) {
  const floc = stateFileLoc;
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

function isEncourageThreshold(messages) {
  if (messages === 0) return false;
  if (messages <= 100 && messages % 10 === 0) return true;
  if (messages % 100 === 0) return true;
  return false;
}

function encourage(messageId, messagesSinceLastGWord, userName) {
  const encouragement = `great job ${userName}, ${messagesSinceLastGWord} messages since last g-word!`;
  ctx.reply(encouragement, { reply_to_message_id: messageId });
}

function maybeEncourage(chatId, fromUserId, messageId) {
  const state = getCurrentState();
  const { messagesSinceLastGWord } = state.counts[chatId][fromUserId];
  const userName = state.users[fromUserId].displayName;
  if (isEncourageThreshold(messagesSinceLastGWord))
    encourage(messageId, messagesSinceLastGWord, userName);
}

bot.on('text', ctx => {

  console.log('Update', JSON.stringify(ctx?.update, null, 2));

  const text = ctx.update.message.text;
  const hasGWord = /\bgood\b/gi.test(text);

  const isPeifen = ctx?.update?.message?.from?.id === 335752116;
  const isMaynard = ctx?.update?.message?.from?.id === 679800187;
  const positiveVibes = isPeifen;

  const messageId = ctx.update.message.message_id;
  const chatId = ctx.update.message.chat.id;
  const fromUserId = ctx.update.message.from.id;

  if (positiveVibes && !hasGWord && (Math.random() < 0.02)) {
    ctx.reply('G**d job for no g-word!!', { reply_to_message_id: ctx.update.message.message_id });
  }

  if (!positiveVibes && hasGWord) {
    ctx.reply('No using the g-word!', { reply_to_message_id: ctx.update.message.message_id });
  }

  if (text === 'g-word stats') {
    const chatId = ctx.update.message.chat.id;
    const state = getCurrentState();
    const response = (
      Object.entries(state.counts[chatId] ?? {})
      .map(([userId, { gWordCount, messageCount, messagesSinceLastGWord }]) => {
        const userName = state.users[userId].displayName;
        const score = -1 * Math.round(Math.sqrt(gWordCount / messageCount) * 100);  // monotonic wrt percentage
        const str = `${userName}: ${score}, ${gWordCount} violations in ${messageCount} messages, ${messagesSinceLastGWord} messages since last use of g-word`;
        return { str, score }
      })
      .sort((a, b) => a.score - b.score)
      .map(a => a.str)
      .join('\n')
    );
    ctx.reply(response, { reply_to_message_id: messageId });
  } else {
    maybeEncourage(chatId, fromUserId, messageId);
  }

  if (text.startsWith('!geval') && isMaynard) {
    const code = text.slice('!geval'.length);
    let response;
    try {
      response = eval(code);
    } catch (e) {
      response = e;
    }
    ctx.reply(response.toString(), { reply_to_message_id: ctx.update.message.message_id });
  }

  // Update statistics
  withState(state => {
    const fromUserName = ctx.update.message.from.first_name ?? ctx.update.message.from.username ?? '<unknown>';
    const chatId = ctx.update.message.chat.id;

    state.counts ??= {};
    state.counts[chatId] ??= {};
    state.counts[chatId][fromUserId] ??= {};
    state.counts[chatId][fromUserId].messageCount ??= 0;
    state.counts[chatId][fromUserId].gWordCount ??= 0;
    state.counts[chatId][fromUserId].messageCount += 1;
    state.counts[chatId][fromUserId].gWordCount += (hasGWord ? 1 : 0);
    const messagesSinceLastGWord = state.counts[chatId][fromUserId].messagesSinceLastGWord ?? 0;
    state.counts[chatId][fromUserId].messagesSinceLastGWord = (hasGWord ? 0 : messagesSinceLastGWord + 1);

    state.users ??= {};
    state.users[fromUserId] ??= {};
    state.users[fromUserId].displayName = fromUserName;
  });

});

bot.launch();
