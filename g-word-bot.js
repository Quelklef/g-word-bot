const fs = require('fs');
const { Telegraf } = require('telegraf');
const { Endog } = require('skim').endog;

async function fetch(...args) {
  const { default: fetch } = await import('node-fetch');
  return await fetch(...args);
}

const bot = new Telegraf(function() {
  if (process.env.G_WORD_BOT_TOKEN)
    return process.env.G_WORD_BOT_TOKEN;
  throw Error('Missing Telegram token. Please set G_WORD_BOT_TOKEN. (maybe try again in a nix-shell)')
}());

function main() {
  bot.launch();
}

// TODO: an endog-telegraf package would be nice, giving the invariant that all events
//       are either in endog or in the telegram server, ie, if we fail to .push() a tg
//       event then it stays in the server

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

      const { text, fromUserId, fromUserName, fromPingName, chatId, hasGWord } = processUpdate(update);

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

      state.inferKitPrompt ??= '';
      if (!text.startsWith('!')) {  // exclude g-word bot commands
        state.inferKitPrompt += `\n${fromPingName}: ${text}`;
        state.inferKitPrompt = state.inferKitPrompt.slice(-5000);  // inferkit uses a limited number of chars
      }
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
  const fromPingName = update?.message?.from?.username ?? update?.message?.from?.first_name;
    // ^ "ping name", ie, what they will be called when you @ them

  return { text, hasGWord, isPeifen, isMaynard, positiveVibes, messageId, chatId, fromUserId, fromUserName, fromPingName };
}


bot.on('text', async ctx => {

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

  // command
  // !infer from @<username>
  // !infer from @<username> { length: integer }
  infer: if (text.startsWith('!infer')) {

    let parsed = null;
    parse: {
      const parts = text.split(' ');
      if (parts.length < 3) break parse;
      const [fst, snd, thd, ...rest] = parts;
      if (fst !== '!infer' || snd !== 'from' || !thd.startsWith('@')) break parse;

      const target = thd.slice(1);

      const prompt = (state.inferKitPrompt + `\n${target}: `).slice(-3000);

      let opts;
      try {
        opts = JSON.parse(rest.join(' ') || 'null');
      } catch (e) {
        break parse;
      }
      const length = opts?.length ?? 35;

      parsed = { target, prompt, length };
    }

    if (parsed === null) {
      ctx.reply('Bad invocation!', { reply_to_message_id: update.message.message_id });
      break infer;
    }

    const { target, prompt, length } = parsed;

    let continuation = null;
    try {
      continuation = await inferText(prompt, length);
    } catch (e) {
      console.error('error when calling inferText', e);
      ctx.reply(
        'Unable to infer. This could be a bug, or g-word bot could be out of weekly free InferKit credits.',
        { reply_to_message_id: update.message.message_id },
      );
    }

    if (continuation !== null)
      ctx.reply(`${target}: ${continuation}`, { reply_to_message_id: update.message.message_id });
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


/* Use the magic of AI to continue some text
   Uses up free weekly credits on inferkit.com */
async function inferText(text, length = 35) {
  const request = {
    method: "POST",
    body: JSON.stringify({
      streamResponse: false,
      prompt: { text, isContinuation: true },
      length,
    }),
  };
  log('inferKit request', request);
  const response = await fetch(
    "https://api.inferkit.com/v1/models/standard/generate?useDemoCredits=true",
    request,
  );
  const result = JSON.parse(await response.text());
  log('inferKit response', result);
  return result.data.text;
}


function log(label, obj) {
  console.log(label + ' ↓');
  console.dir(obj, { depth: null });
}

main();
