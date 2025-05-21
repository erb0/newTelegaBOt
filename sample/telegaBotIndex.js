const TelegramApi = require("node-telegram-bot-api");

require("dotenv").config();

const { connection, userState } = require("./module/conectionDb");

const { search } = require("./module/options");

const { auth } = require("./module/auth");

const { main } = require("./module/reportKaspi");

const { log, reportLocation, formatDate } = require("./module/plugin");

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

  try {
    if (auth[chatId]) {
      if (text === "/start" || text === "🔍 поиск") {
        const currentDateTime = new Date();
        const formattedDateTime = formatDate(currentDateTime);
        delete userState[chatId];
        console.log(name + " производит поиск " + formattedDateTime);
        await bot.sendMessage(
          498318670,
          name + " производит поиск " + formattedDateTime
        );
        await bot.sendMessage(chatId, "Выберите тип поиска", search);
      } else if (text === `/report`) {
        delete userState[chatId];
        userState[chatId] = { state: "report" };
        bot.sendMessage(chatId, "Введите код контролера");
      } else if (text === `/kaspi` && chatId === 498318670) {
        delete userState[chatId];
        await main(chatId, connection, bot);
      } else if (text === `🔍 по л/с`) {
        delete userState[chatId];
        userState[chatId] = { state: "searchbyuser" };
        await bot.sendMessage(chatId, "Введите л/с:", search);
      } else if (text === `🔍 по вм`) {
        delete userState[chatId];
        userState[chatId] = { state: "searchwm" };
        await bot.sendMessage(chatId, "Введите номер в/м:", search);
      } else if (text === `🔍 по фио`) {
        delete userState[chatId];
        userState[chatId] = { state: "searchbyname" };
        await bot.sendMessage(chatId, "Введите фио", search);
      } else if (text === `💸 платежи`) {
        return searchPayment(chatId, userState, bot);
      } else if (text === `📋 показаний`) {
        return searchCheap(chatId, userState, bot);
      } else if (
        userState[chatId] &&
        userState[chatId].state === "searchbyuser"
      ) {
        const type = "лицевой счет";
        console.log(name + " Л/с: " + text);
        await bot.sendMessage(498318670, name + " Л/с: " + text);
        log(chatId, name, text, type);
        return searchByUser(chatId, text, bot);
      } else if (userState[chatId] && userState[chatId].state === "searchwm") {
        const type = "номер водомера";
        console.log(name + " В/м: " + text);
        await bot.sendMessage(498318670, name + " В/м: " + text);
        log(chatId, name, text, type);
        return searchByWm(chatId, text, bot);
      } else if (
        userState[chatId] &&
        userState[chatId].state === "searchbyname"
      ) {
        const type = "фио";
        console.log(name + " ФИО: " + text);
        await bot.sendMessage(498318670, name + " ФИО: " + text);
        log(chatId, name, text, type);
        return searchByName(chatId, text, bot);
      } else if (userState[chatId] && userState[chatId].state === "report") {
        return reportLocation(chatId, text, bot, connection, userState);
      } else {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, используйте кнопки для взаимодействия с ботом."
        );
      }
    } else {
      await bot.sendMessage(chatId, "Вы не авторизованы!");
    }
  } catch (e) {
    console.error(e);
    return bot.sendMessage(chatId, "Произошла какая то ошибочка!");
  }
});

bot.on("callback_query", (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  try {
    if (auth[chatId]) {
      if (data.startsWith("searchUser_")) {
        const searchValue = data.split("_")[1];
        searchByUser(chatId, searchValue, bot);
      }
    } else {
      bot.sendMessage(chatId, "Вы не авторизованы!");
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
