const { Markup } = require("telegraf");

module.exports = {
  menu: Markup.inlineKeyboard([
    [
      Markup.button.callback("💸 платежи", "payments"),
      Markup.button.callback("📋 показания", "cheap"),
    ],
    // [Markup.button.callback('🔍 поиск', 'search')],
  ]),
  cheap: Markup.inlineKeyboard([
    [
      Markup.button.callback("◀ назад", "back"),
      // Markup.button.callback("📋 показания", "cheap"),
    ],
  ]),
  payments: Markup.inlineKeyboard([
    Markup.button.callback("◀ назад", "back"),
    // Markup.button.callback("💸 платежи", "payments"),
  ]),
  reportKb: Markup.keyboard([[{ text: "повторить поиск" }]]).resize(),
  search: Markup.keyboard([
    [{ text: "🔍 по л/с" }, { text: "🔍 по вм" }],
    [{ text: "🔍 по фио" }],
  ]).resize(),
  byWm: (text, data) => {
    return Markup.inlineKeyboard([[Markup.button.callback(text, data)]]);
  },
  clear: () => {
    return {
      reply_markup: JSON.stringify({
        remove_keyboard: true,
      }),
    };
  },
};
