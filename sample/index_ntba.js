const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const { connectToDatabase, User } = require("./modules/db");

connectToDatabase();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let user = await User.findOne({ user_id: userId });

  if (!user) {
    user = new User({
      user_id: userId,
      username: msg.from.username,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      language_code: msg.from.language_code,
      state: "start",
      created_at: new Date(),
    });
    await user.save();
  }

  switch (msg.text) {
    case "/start":
      await User.updateOne({ user_id: userId }, { state: "start" });
      bot.sendMessage(chatId, "Привет! Добро пожаловать!");
      break;
    case "/settings":
      await User.updateOne({ user_id: userId }, { state: "settings" });
      bot.sendMessage(userId, "Вы вошли в настройки.");
      break;
    default:
      switch (user.state) {
        case "start":
          user.data = { ...user.data, startMessage: msg.text };
          await user.save();
          await bot.sendMessage(chatId, "Вы находитесь в start. " + msg.text);
          if (user.data.settingsMessage) {
            bot.sendMessage(
              chatId,
              "text settings " + user.data.settingsMessage
            );
          }
          break;
        case "settings":
          user.data = { ...user.data, settingsMessage: msg.text };
          await user.save();
          await bot.sendMessage(
            chatId,
            "Вы находитесь в настройках. " + msg.text
          );
          if (user.data.startMessage)
            bot.sendMessage(chatId, "text start " + user.data.startMessage);
          break;

        default:
          bot.sendMessage(chatId, "Привет! Добро пожаловать!");
      }
  }
});
