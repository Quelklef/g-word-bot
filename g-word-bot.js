const fs = require('fs');
const { Telegraf } = require('telegraf');
const { Endog } = require('skim').endog;

const bot = new Telegraf(function() {
  if (process.env.G_WORD_BOT_TOKEN)
    return process.env.G_WORD_BOT_TOKEN;
  throw Error('Missing Telegram token. Please set G_WORD_BOT_TOKEN. (maybe try again in a nix-shell)')
}());

function main() {
  bot.launch();
}


const endog = new Endog({

  logloc: process.env.G_WORD_BOT_JOURNAL_LOC,

  tolerance: 5 * 1000,

  getTime(ev) {
    return new Date(ev.time);
  },

  exec(state, ev) {

    if (ev.kind === 'set-state') {
      for (k in state) delete state[k];
      Object.assign(state, ev.payload);
    }

    else if (ev.kind === 'tg-update') {
      const { update } = ev;

      const { fromUserId, fromUserName, chatId, hasGWord } = processUpdate(update);

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
    }

    else {
      throw Error(`Unknown event kind ${ev.kind}`);
    }

  },

});


{  // Handle migration to endog
  const legacyStatefileLoc = process.env.G_WORD_BOT_LEGACY_STATEFILE_LOC;
  if (!endog.state.migratedToEndog) {
    const oldState = JSON.parse(fs.readFileSync(legacyStatefileLoc).toString());
    const state0 = { ...oldState, migratedToEndog: true };
    endog.push({ kind: 'set-state', time: Date.now(), payload: state0 });
  }
  if (legacyStatefileLoc) {
    console.warn(`[WARN] Migration to endog complete. G_WORD_BOT_LEGACY_STATEFILE_LOC can be unset.`);
  }
}


function processUpdate(update) {
  const text = update.message.text;
  const hasGWord = /\bgood\b/gi.test(text);

  const isPeifen = update?.message?.from?.id === 335752116;
  const isMaynard = update?.message?.from?.id === 679800187;
  const positiveVibes = isPeifen;

  const messageId = update.message.message_id;
  const chatId = update.message.chat.id;
  const fromUserId = update.message.from.id;
  const fromUserName = update.message.from.first_name ?? update.message.from.username ?? '<unknown>';

  return { text, hasGWord, isPeifen, isMaynard, positiveVibes, messageId, chatId, fromUserId, fromUserName };
}


bot.on('text', ctx => {

  const { update } = ctx;

  console.log('Update', JSON.stringify(update, null, 2));
  endog.push({ kind: 'tg-update', time: Date.now(), update });
  const state = endog.state;

  const { text, hasGWord, isMaynard, positiveVibes, messageId, chatId, fromUserId, fromUserName }
        = processUpdate(update);

  if (positiveVibes && !hasGWord && (Math.random() < 0.02)) {
    ctx.reply('G**d job for no g-word!!', { reply_to_message_id: update.message.message_id });
  }

  if (!positiveVibes && hasGWord) {
    ctx.reply('No using the g-word!', { reply_to_message_id: update.message.message_id });
  }

  if (text === 'g-word stats') {
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
  }

  if (text.startsWith('!geval') && isMaynard) {
    const code = text.slice('!geval'.length);
    let response;
    try {
      response = eval(code);
    } catch (e) {
      response = e;
    }
    ctx.reply(response.toString(), { reply_to_message_id: update.message.message_id });
  }

  const { messagesSinceLastGWord } = state.counts[chatId][fromUserId];
  const doEncouragement = (
    messagesSinceLastGWord <= 150 && messagesSinceLastGWord % 25 === 0
    || messagesSinceLastGWord % 150 === 0
  );
  if (doEncouragement) {
    ctx.reply(
      `great job, ${fromUserName}, ${messagesSinceLastGWord} messages since last g-word!`,
      { reply_to_message_id: messageId }
    );
  }

});


main();
