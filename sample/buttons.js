const { Markup } = require("telegraf");

const restart = Markup.inlineKeyboard([
  [Markup.button.callback("Ввести другой л/c", "restart")],
]);
const yes = Markup.inlineKeyboard([Markup.button.callback("Да", "yes")]);

module.exports = {
  restart,
  yes,
};
