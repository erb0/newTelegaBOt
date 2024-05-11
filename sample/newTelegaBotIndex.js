const TelegramApi = require("node-telegram-bot-api");

require("dotenv").config();

const { connection, userState } = require("./module/conectionDb");

const { search } = require("./module/options");

const { auth } = require("./module/auth");

const { main } = require("./module/reportKaspi");

const { log } = require("./module/plugin");

const {
  searchByName,
  searchPayment,
  searchCheap,
  searchByUser,
  searchByWm,
} = require("./module/sqlQuery");

const token = process.env.TOKEN_BOT;

const bot = new TelegramApi(token, { polling: true });

bot.on("message", async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const name = auth[chatId] ? auth[chatId].name : "Unknown";
  let type;

  try {
    if (!auth[chatId]) {
      await bot.sendMessage(chatId, "Вы не авторизованы!");
      return;
    }
    switch (text) {
      case "/start":
      case "🔍 поиск":
        delete userState[chatId];
        await bot.sendMessage(chatId, "Выберите тип поиска", search);
        break;
      case "/kaspi":
        if (chatId === 498318670) {
          delete userState[chatId];
          await main(chatId, connection, bot);
        }
        break;
      case "🔍 по л/с":
        delete userState[chatId];
        userState[chatId] = { state: "searchbyuser" };
        await bot.sendMessage(chatId, "Введите л/с:", search);
        break;
      case "🔍 по вм":
        delete userState[chatId];
        userState[chatId] = { state: "searchwm" };
        await bot.sendMessage(chatId, "Введите номер в/м:", search);
        break;
      case "🔍 по фио":
        delete userState[chatId];
        userState[chatId] = { state: "searchbyname" };
        await bot.sendMessage(chatId, "Введите фио", search);
        break;
      case "💸 платежи":
        searchPayment(chatId, userState, bot);
        break;
      case "📋 показаний":
        searchCheap(chatId, userState, bot);
        break;
      default:
        switch (userState[chatId] ? userState[chatId].state : "") {
          case "searchbyuser":
            type = "лицевой счет";
            console.log(name + type + text);
            await bot.sendMessage(498318670, `${name} ${type} ${text}`);
            log(chatId, name, text, type);
            searchByUser(chatId, text, bot);
            break;
          case "searchwm":
            type = "номер водомера";
            console.log(name + type + text);
            await bot.sendMessage(498318670, `${name} ${type} ${text}`);
            log(chatId, name, text, type);
            searchByWm(chatId, text, bot);
            break;
          case "searchbyname":
            type = "фио";
            console.log(name + type + text);
            await bot.sendMessage(498318670, `${name} ${type} ${text}`);
            log(chatId, name, text, type);
            searchByName(chatId, text, bot);
            break;
          default:
            await bot.sendMessage(
              chatId,
              "Пожалуйста, используйте кнопки для взаимодействия с ботом."
            );
        }
        break;
    }
  } catch (e) {
    console.error(e);
    return bot.sendMessage(chatId, "Произошла какая то ошибочка!");
  }
});

bot.on("callback_query", async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  try {
    if (!auth[chatId]) {
      await bot.sendMessage(chatId, "Вы не авторизованы!");
      return;
    }
    if (data.startsWith("searchUser_")) {
      const searchValue = data.split("_")[1];
      await searchByUser(chatId, searchValue, bot);
      return;
    }
  } catch (error) {
    console.error(error);
    return bot.sendMessage(chatId, "Произошла какая то ошибочка!");
  }
});

bot.on("polling_error", (error) => {
  console.error("Ошибка при получении обновлений:", error);
});

console.log("Бот успешно запущен.");
