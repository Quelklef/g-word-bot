#!/usr/bin/env python

import os
import random
import logging

from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)

logger = logging.getLogger(__name__)


with open('./words.txt', 'r') as f:
  prohibited_words = set(f.read().strip().split('\n'))


def get_bot_token():
  token_file = './token.txt'
  if os.path.isfile(token_file):
    with open(token_file, 'r') as f:
      return f.read().strip()
  else:
    token = input('Token: ')
    with open(token_file, 'w') as f:
      f.write(token + '\n')
    return token


def echo(update: Update, context: CallbackContext) -> None:
    """Echo the user message."""
    words = {word.lower() for word in update.message.text.split(' ')}
    if words & prohibited_words > set():
      update.message.reply_text(random.choice([
        "could you phrase that in a way that takes accountability for your subjectivity thx :3",
        "h-hey, gentle reminder that that word suggests objectivity, um...",
        "such use of language can invalidate personal experience, just be careful. thanks~~",
      ]))


def main():
    updater = Updater(get_bot_token(), use_context=True)
    dispatcher = updater.dispatcher
    dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, echo))
    updater.start_polling()
    updater.idle()


if __name__ == '__main__':
    main()
