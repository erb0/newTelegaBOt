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

const { authChatId } = require("./modules/auth");

connectToDatabase();

function botStart() {
  const token = process.env.TELEGRAM_TOKEN;
  const bot = new Telegraf(token);
  bot.command("start", async (ctx) => {
    try {
      ctx.reply(`Привет ${ctx.from.first_name || "unknown"}! Добро пожаловать!
Доступные команды:
/info - Для получение информаций об абонентах\n
/insert - Для внесение показания абонентов\n
/didntPay - Списки не оплативших абонентов по коду контролера`);
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

  bot.command("didntPay", async (ctx) => {
    try {
      ctx.reply("Введите код участка.");
      await User.updateOne({ user_id: ctx.from.id }, { state: "didntPay" });
    } catch (e) {
      console.log("cant handle didntPay command", e);
    }
  });

  bot.command("info", async (ctx) => {
    try {
      ctx.replyWithHTML("Выберите тип поиска", search);
    } catch (e) {
      console.log("cant handle info command", e);
    }
  });

  bot.command("list", async (ctx) => {
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
      const message = parseObjText(locationCodes);

      const messageParts = splitMessage(message, 4000); // Максимальная длина сообщения в Telegram - 4096 символов

      // Пример отправки сообщения в контексте бота
      async function sendDeskCodes(ctx, messageParts) {
        for (const part of messageParts) {
          await ctx.reply(part);
        }
      }
      await sendDeskCodes(ctx, messageParts);
    } catch (e) {
      console.log("cant handle list command", e);
    }
  });

  bot.command("insert", async (ctx) => {
    const chatId = ctx.chat.id;
    if (authChatId[chatId]) {
      await ctx.replyWithHTML(
        `Вы вошли как <i><b>${authChatId[chatId].name}</b></i>`
      );
      await User.updateOne(
        { user_id: ctx.from.id },
        { state: "insertConscode" }
      );
      await ctx.replyWithHTML(
        "Введите л/с для внесения показаний счетчиков!",
        clear()
      );
    } else {
      await ctx.replyWithHTML("Вы не авторизовались", clear());
    }
  });

  bot.command("kaspi", async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      if (chatId !== 498318670) {
        return ctx.replyWithHTML("У вас нет доступа для этой команды!");
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
      switch (text) {
        case "🔍 по л/с":
          ctx.replyWithHTML("Введите л/с:", search);
          await User.updateOne({ user_id: userId }, { state: "searchbyuser" });
          break;
        case "🔍 по вм":
          ctx.replyWithHTML("Введите номер в/м:", search);
          await User.updateOne({ user_id: userId }, { state: "searchwm" });
          break;
        case "🔍 по фио":
          ctx.replyWithHTML("Введите фио", search);
          await User.updateOne({ user_id: userId }, { state: "searchbyname" });
          break;
        default:
          switch (user.state) {
            // case "start":
            //   user.data = { ...user.data, startMessage: text };
            //   await user.save();
            //   ctx.reply("Вы находитесь в start. " + text);
            //   if (user.data.settingsMessage) {
            //     ctx.reply("text settings " + user.data.settingsMessage);
            //   }
            //   break;
            case "didntPay":
              await didntPay(text, ctx, connection);
              break;
            case "searchbyuser":
              searchByUser(text, ctx, User);
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
              ctx.reply("Выберите команду....");
          }
          break;
      }
    } catch (e) {
      console.error(e);
      return ctx.reply("Произошла какая то ошибочка!");
    }
  });

  bot.action("payments", (ctx) => {
    searchPayment(User, ctx);
  });
  bot.action("cheap", (ctx) => {
    searchCheap(User, ctx);
  });
  bot.action("back", (ctx) => {
    back(User, ctx);
  });

  bot.action(/searchUser_(.+)/, async (ctx) => {
    const text = ctx.match[1];
    searchByUser(text, ctx, User);
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
    ctx.reply("Введите л/с!");
  });
  console.log("Bot have been started successfully.");
  return bot;
}

module.exports = botStart;
