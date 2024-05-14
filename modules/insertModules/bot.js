const {
  userInfoForInsert,
  wcodeInfoForInsert,
  insertValue,
  insertIfYes,
} = require("./sql");
const { authChatId } = require("./auth");

function setupBot(Telegraf, token) {
  const telegrafBot = new Telegraf(token);

  const useState = {};

  telegrafBot.command("insert", async (ctx) => {
    const chatId = ctx.chat.id;
    if (authChatId[chatId]) {
      await ctx.replyWithHTML(
        `Вы вошли как <i><b>${authChatId[chatId].name}</b></i>`
      );
      useState[chatId] = { state: "insertConscode" };
      await ctx.reply("Введите л/с!");
    } else {
      await ctx.replyWithHTML("Вы не авторизовались");
    }
  });

  telegrafBot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const txt = ctx.message.text;
    if (authChatId[chatId]) {
      if (
        useState[chatId] &&
        useState[chatId].state === "insertConscode" &&
        isNaN(txt)
      ) {
        ctx.reply("Введите число❗");
      } else if (
        useState[chatId] &&
        useState[chatId].state === "insertConscode"
      ) {
        await userInfoForInsert(chatId, txt, ctx, useState);
      } else if (useState[chatId] && useState[chatId].state === "insertValue") {
        await insertValue(ctx, useState);
      } else if (useState[chatId] && useState[chatId].state === "null") {
        ctx.reply("Выберите команду!");
      } else {
        await ctx.deleteMessage();
        ctx.reply("Выберите счетчик!");
      }
    } else {
      await ctx.replyWithHTML("Вы не авторизовались");
    }
  });

  telegrafBot.action(/^wcode_/, async (ctx) => {
    await wcodeInfoForInsert(ctx, useState);
  });

  telegrafBot.action("yes", async (ctx) => {
    await insertIfYes(ctx, useState);
  });

  telegrafBot.action("restart", async (ctx) => {
    await ctx.deleteMessage();
    const chatId = ctx.chat.id;
    useState[chatId] = { state: "insertConscode" };
    ctx.reply("Введите л/с!");
  });

  return telegrafBot;
}

module.exports = setupBot;
