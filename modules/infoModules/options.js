const { Markup } = require("telegraf");

module.exports = {
  menu: Markup.keyboard([
    [{ text: "💸 платежи" }, { text: "📋 показания" }],
    [{ text: "🔍 поиск" }],
  ]).resize(),
  reportKb: Markup.keyboard([[{ text: "повторить поиск" }]]).resize(),
  search: Markup.keyboard([
    [{ text: "🔍 по л/с" }, { text: "🔍 по вм" }],
    [{ text: "🔍 по фио" }],
  ]).resize(),
};
