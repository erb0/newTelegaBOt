const { Telegraf } = require("telegraf");
require("dotenv").config();
const { connectToDatabase, User } = require("./modules/db");

connectToDatabase();

const token = process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(token);

bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  ctx.reply("Привет! Добро пожаловать!");

  let user = await User.findOne({ user_id: userId });

  if (!user) {
    user = new User({
      user_id: userId,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      language_code: ctx.from.language_code,
      state: "start",
      created_at: new Date(),
    });
    await user.save();
  } else {
    await User.updateOne({ user_id: userId }, { state: "start" });
  }
});

bot.command("settings", async (ctx) => {
  const userId = ctx.from.id;

  ctx.reply("Вы вошли в настройки.");

  await User.updateOne({ user_id: userId }, { state: "settings" });
});

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const user = await User.findOne({ user_id: userId });

  switch (user.state) {
    case "start":
      user.data = { ...user.data, startMessage: ctx.message.text };
      await user.save();
      ctx.reply("Вы находитесь в start. " + ctx.message.text);
      if (user.data.settingsMessage) {
        ctx.reply("text settings " + user.data.settingsMessage);
      }
      break;
    case "settings":
      user.data = { ...user.data, settingsMessage: ctx.message.text };
      await user.save();
      ctx.reply("Вы находитесь в настройках. " + ctx.message.text);
      if (user.data.startMessage)
        ctx.reply("text start " + user.data.startMessage);
      break;
    default:
      ctx.reply("Привет! Добро пожаловать!");
  }
});

bot.launch().then(() => {
  console.log("bot started...");
});
