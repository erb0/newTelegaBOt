const { Telegraf } = require("telegraf");
require("dotenv").config();
const { connectToDatabase, User } = require("./modules/mongoDb");

const { search, clear } = require("./modules/button");
const {
  connection,
  parseObjText,
  locationCodes,
} = require("./modules/accessDb");
const { didntPay } = require("./modules/reports/didntPay");
const { main } = require("./modules/reports/reportKaspi");
const {
  searchByName,
  searchPayment,
  searchCheap,
  searchByUser,
  searchByWm,
  back,
} = require("./modules/sqlInfo");
const {
  userInfoForInsert,
  wcodeInfoForInsert,
  insertValue,
  insertIfYes,
} = require("./modules/sqlInsert");

const { authChatId, auth } = require("./modules/auth");

connectToDatabase();

function botStart() {
  const token = process.env.TELEGRAM_TOKEN;
  const bot = new Telegraf(token);

  async function safeReply(ctx, ...args) {
    try {
      await ctx.replyWithHTML(...args);
    } catch (error) {
      if (error.response && error.response.error_code === 403) {
        console.log(`User ${ctx.from.id} blocked the bot.`);
      } else {
        console.error(`Failed to send message to ${ctx.from.id}:`, error);
      }
    }
  }

  bot.command("start", async (ctx) => {
    try {
      if (!authChatId[ctx.from.id]) {
        return ctx.reply("Вы не авторизованы!");
      }
      await safeReply(
        ctx,
        `Привет ${ctx.from.first_name || "unknown"}! Добро пожаловать!
Доступные команды:
/info - Для получение информаций об абонентах\n
/insert - Для внесение показания абонентов\n
/list - Коды контролеров\n
/didntpay - Списки не оплативших абонентов по коду контролера`
      );

      let user = await User.findOne({ user_id: ctx.from.id });
      if (!user) {
        user = new User({
          user_id: ctx.from.id,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
          language_code: ctx.from.language_code,
          state: "start",
          privileges: "user",
          created_at: new Date(),
        });
        await user.save();
      } else {
        await User.updateOne({ user_id: ctx.from.id }, { state: "start" });
      }
    } catch (e) {
      console.log("cant handle start command", e);
    }
  });

  bot.command("didntpay", async (ctx) => {
    try {
      if (!authChatId[ctx.from.id]) {
        return ctx.reply("Вы не авторизованы!");
      }
      await safeReply(ctx, `Введите код контролера.\n*коды контролеров /list`);
      await User.updateOne({ user_id: ctx.from.id }, { state: "didntPay" });
    } catch (e) {
      console.log("cant handle didntPay command", e);
    }
  });

  bot.command("info", async (ctx) => {
    try {
      if (!authChatId[ctx.from.id]) {
        return ctx.reply("Вы не авторизованы!");
      }
      await safeReply(ctx, "Выберите тип поиска", search);
    } catch (e) {
      console.log("cant handle info command", e);
    }
  });

  bot.command("list", async (ctx) => {
    try {
      if (!authChatId[ctx.from.id]) {
        return ctx.reply("Вы не авторизованы!");
      }
      await safeReply(
        ctx,
        "Введите ФИО контролера или наименование сельского округа."
      );
      await User.updateOne({ user_id: ctx.from.id }, { state: "list" });
    } catch (e) {
      console.log("cant handle list command", e);
    }
  });

  bot.command("insert", async (ctx) => {
    const chatId = ctx.chat.id;
    if (authChatId[chatId]) {
      await safeReply(
        ctx,
        `Вы вошли как <i><b>${authChatId[chatId].name}</b></i>`
      );
      await User.updateOne(
        { user_id: ctx.from.id },
        { state: "insertConscode" }
      );
      await safeReply(
        ctx,
        "Введите л/с для внесения показаний счетчиков!",
        clear()
      );
    } else {
      await safeReply(ctx, "Вы не авторизовались", clear());
    }
  });

  bot.command("kaspi", async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      if (chatId !== 498318670) {
        return await safeReply(ctx, "У вас нет доступа для этой команды!");
      }
      await main(chatId, connection, bot);
    } catch (e) {
      console.log("cant handle kaspi command", e);
    }
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const user = await User.findOne({ user_id: userId });
    const text = ctx.message.text;
    try {
      if (!authChatId[ctx.from.id]) {
        return ctx.reply("Вы не авторизованы!");
      }
      switch (text) {
        case "🔍 по л/с":
          await safeReply(ctx, "Введите л/с:", search);
          await User.updateOne({ user_id: userId }, { state: "searchbyuser" });
          break;
        case "🔍 по вм":
          await safeReply(ctx, "Введите номер в/м:", search);
          await User.updateOne({ user_id: userId }, { state: "searchwm" });
          break;
        case "🔍 по фио":
          await safeReply(ctx, "Введите фио", search);
          await User.updateOne({ user_id: userId }, { state: "searchbyname" });
          break;
        default:
          switch (user.state) {
            case "didntPay":
              await didntPay(text, ctx, connection);
              break;
            case "list":
              try {
                function splitMessage(message, maxLength) {
                  const parts = [];
                  let part = "";

                  message.split("\n").forEach((line) => {
                    if ((part + line).length > maxLength) {
                      parts.push(part);
                      part = "";
                    }
                    part += `${line}\n`;
                  });

                  if (part.length > 0) {
                    parts.push(part);
                  }

                  return parts;
                }

                const message = parseObjText(locationCodes, text);

                if (message.trim() === "") {
                  await safeReply(ctx, "Ничего не найдено.");
                } else {
                  const messageParts = splitMessage(message, 4000);

                  async function sendDeskCodes(ctx, messageParts) {
                    for (const part of messageParts) {
                      await safeReply(ctx, part);
                    }
                  }

                  await sendDeskCodes(ctx, messageParts);
                }
              } catch (e) {
                console.log("Не удается обработать состояние list", e);
              }
              break;
            case "searchbyuser":
              if (!authChatId[userId].section) {
                return ctx.reply("Нет доступа.");
              }
              const locationCodeArray = authChatId[userId].section
                .map((value) => `'${value}'`)
                .join(",");
              searchByUser(locationCodeArray, text, ctx, User);
              break;
            case "searchwm":
              searchByWm(text, ctx);
              break;
            case "searchbyname":
              searchByName(text, ctx);
              break;
            case "insertConscode":
              userInfoForInsert(userId, text, ctx, User);
              break;
            case "insertValue":
              insertValue(userId, text, ctx, User);
              break;
            default:
              await safeReply(ctx, "Выберите команду....");
          }
          break;
      }
    } catch (e) {
      console.error(e);
      return await safeReply(ctx, "Произошла какая то ошибочка!");
    }
  });

  bot.action("payments", (ctx) => {
    if (!authChatId[ctx.from.id]) {
      return ctx.reply("Вы не авторизованы!");
    }
    searchPayment(User, ctx);
  });
  bot.action("cheap", (ctx) => {
    if (!authChatId[ctx.from.id]) {
      return ctx.reply("Вы не авторизованы!");
    }
    searchCheap(User, ctx);
  });
  bot.action("back", (ctx) => {
    if (!authChatId[ctx.from.id]) {
      return ctx.reply("Вы не авторизованы!");
    }
    back(User, ctx);
  });

  bot.action(/searchUser_(.+)/, async (ctx) => {
    if (!authChatId[ctx.from.id]) {
      return ctx.reply("Вы не авторизованы!");
    }
    const text = ctx.match[1];
    if (!authChatId[ctx.from.id].section) {
      return ctx.reply("Нет доступа.");
    }
    const locationCodeArray = authChatId[ctx.from.id].section
      .map((value) => `'${value}'`)
      .join(",");
    searchByUser(locationCodeArray, text, ctx, User);
    await User.updateOne({ user_id: ctx.from.id }, { state: "info" });
  });

  bot.action(/^wcode_/, (ctx) => {
    wcodeInfoForInsert(ctx, User);
  });

  bot.action("yes", async (ctx) => {
    await ctx.deleteMessage();
    insertIfYes(ctx, User);
  });

  bot.action("restart", async (ctx) => {
    const userId = ctx.chat.id;
    await ctx.deleteMessage();
    await User.updateOne({ user_id: userId }, { state: "insertConscode" });
    await safeReply(ctx, "Введите л/с!");
  });

  // bot.on("photo", async (ctx) => {
  //   await wmList(ctx);
  // });

  console.log("Bot have been started successfully.");
  return bot;
}

module.exports = botStart;
