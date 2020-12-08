#!/usr/bin/env python

import logging

from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)

logger = logging.getLogger(__name__)


with open('./words.txt', 'r') as f:
  prohibited_words = set(f.read().strip().split('\n'))


def echo(update: Update, context: CallbackContext) -> None:
    """Echo the user message."""
    if set(update.message.text.split(' ')) & prohibited_words > set():
      update.message.reply_text('watch ur language')


def main():
    updater = Updater("1464169021:AAE2NbcxNw16UukM8QYxgqV8qV7IvYs0abM", use_context=True)
    dispatcher = updater.dispatcher
    dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, echo))
    updater.start_polling()
    updater.idle()


if __name__ == '__main__':
    main()
