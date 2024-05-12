const { Markup } = require('telegraf')

module.exports = {
  menu: Markup.inlineKeyboard([
    [
      Markup.button.callback('💸 платежи', 'payments'),
      Markup.button.callback('📋 показания', 'cheap'),
    ],
    [Markup.button.callback('🔍 поиск', 'search')],
  ]),
  reportKb: Markup.keyboard([[{ text: 'повторить поиск' }]]).resize(),
  search: Markup.keyboard([
    [{ text: '🔍 по л/с' }, { text: '🔍 по вм' }],
    [{ text: '🔍 по фио' }],
  ]).resize(),
}
