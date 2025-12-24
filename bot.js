const { Telegraf } = require("telegraf");
require("dotenv").config();
const { connectToDatabase, User, Log, Photo } = require("./modules/mongoDb");
const { search, clear } = require("./modules/button");
const LogService = require("./services/LogService");

const { createClient } = require("@supabase/supabase-js");
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
  handlePhotoUpload,
} = require("./modules/sqlInfo");
const {
  userInfoForInsert,
  wcodeInfoForInsert,
  insertValue,
  insertIfYes,
} = require("./modules/sqlInsert");

// Новая система RBAC
const { ROLES } = require("./models/User");
const { ensureAuth: ensureAuthMiddleware, canInsertReadings, requireRole } = require("./middlewares/auth");
const { setupAdminCommands } = require("./bot-admin");

connectToDatabase();

function botStart() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BUCKET_NAME = process.env.BUCKET_NAME;
  const token = process.env.TELEGRAM_TOKEN;
  const bot = new Telegraf(token, {
    handlerTimeout: 300000, // до 5 минут
  });

  // Подключить команды администратора (новая система RBAC)
  setupAdminCommands(bot);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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

  const stateHandlers = {
    didntPay: async (text, ctx) => {
      await didntPay(text, ctx, connection);
    },
    list: async (text, ctx) => {
      const message = parseObjText(locationCodes, text);
      if (!message.trim()) return safeReply(ctx, "Ничего не найдено.");
      const parts = message.match(/.{1,4000}(\n|$)/g);
      for (const part of parts) await safeReply(ctx, part);
    },
    searchbyuser: async (text, ctx, user) => {
      // Получить доступные участки из новой системы RBAC
      const accessibleSections = await user.getAccessibleSections();

      let codeArray;
      if (accessibleSections === null) {
        // Админ/Ревизор - доступ ко всем участкам
        codeArray = null; // null означает доступ ко всем
      } else if (accessibleSections.length === 0) {
        return ctx.reply("❌ У вас нет доступных участков. Обратитесь к администратору.");
      } else {
        codeArray = accessibleSections.map((v) => `'${v}'`).join(",");
      }

      await searchByUser(codeArray, text, ctx, User);
    },
    searchwm: (text, ctx) => searchByWm(text, ctx, User),
    searchbyname: (text, ctx) => searchByName(text, ctx, User),
    insertConscode: (text, ctx, user) =>
      userInfoForInsert(user.user_id, text, ctx, User),
    insertValue: (text, ctx, user) =>
      insertValue(user.user_id, text, ctx, User),
  };

  bot.command("start", async (ctx) => {
    // Проверка авторизации в новой системе RBAC
    let user = await User.findOne({ user_id: ctx.from.id });

    if (!user) {
      // Новые пользователи НЕ создаются автоматически
      return ctx.reply("❌ Вы не авторизованы! Обратитесь к администратору для получения доступа.");
    }

    if (user.is_blocked) {
      return ctx.reply("❌ Ваш аккаунт заблокирован! Обратитесь к администратору.");
    }

    if (!user.is_active) {
      return ctx.reply("❌ Ваш аккаунт неактивен! Обратитесь к администратору.");
    }

    // Обновление информации о последнем входе
    user.last_login = new Date();
    user.state = "start";
    await user.save();

    await safeReply(
      ctx,
      `Привет ${user.first_name || ctx.from.first_name || "unknown"}! Добро пожаловать!

👤 Роль: <b>${user.role}</b>
📊 Участков: ${user.sections?.length || 0}

Доступные команды:
/info - Для получения информации об абонентах
/insert - Для внесения показаний абонентов
/list - Коды контролеров
/didntpay - Списки не оплативших абонентов по коду контролера
${user.role === ROLES.ADMIN ? '\n🔧 /adminhelp - Команды администратора' : ''}`
    );
  });

  bot.command("didntpay", ensureAuthMiddleware, async (ctx) => {
    await safeReply(ctx, `Введите код контролера.\n*коды контролеров /list`);
    await User.updateOne({ user_id: ctx.from.id }, { state: "didntPay" });
  });

  bot.command("info", ensureAuthMiddleware, async (ctx) => {
    await safeReply(ctx, "Выберите тип поиска", search);
  });

  bot.command("list", ensureAuthMiddleware, async (ctx) => {
    await safeReply(
      ctx,
      "Введите ФИО контролера или наименование сельского округа."
    );
    await User.updateOne({ user_id: ctx.from.id }, { state: "list" });
  });

  bot.command("insert", ensureAuthMiddleware, canInsertReadings, async (ctx) => {
    const user = ctx.state.user; // Пользователь доступен через ctx.state

    await safeReply(
      ctx,
      `Вы вошли как <i><b>${user.first_name}</b></i>\nРоль: <b>${user.role}</b>`
    );
    await User.updateOne({ user_id: ctx.from.id }, { state: "insertConscode" });
    await safeReply(
      ctx,
      "Введите л/с для внесения показаний счетчиков!",
      clear()
    );
  });

  bot.command("kaspi", async (ctx) => {
    if (ctx.chat.id !== 498318670)
      return await safeReply(ctx, "У вас нет доступа для этой команды!");
    await main(ctx.chat.id, connection, bot);
  });

  // Старая команда /mongo заменена на /export_search
  // Используйте /export_search, /export_insert, /export_errors или /export_all

  // ========== НОВЫЕ КОМАНДЫ ЭКСПОРТА ЛОГОВ ==========

  bot.command("export_search", ensureAuthMiddleware, requireRole(ROLES.ADMIN), async (ctx) => {
    try {
      await ctx.reply("🔄 Экспортирую логи поиска...");
      const logService = new LogService(bot);
      const filePath = await logService.exportSearchLogs();
      await ctx.replyWithDocument({ source: filePath });
      await ctx.reply("✅ Логи поиска успешно экспортированы!");
    } catch (error) {
      const logService = new LogService();
      await logService.logError(error, "bot.export_search", ctx.chat.id, ctx.from.first_name);
      await ctx.reply(`❌ Ошибка при экспорте: ${error.message}`);
    }
  });

  bot.command("export_insert", ensureAuthMiddleware, requireRole(ROLES.ADMIN), async (ctx) => {
    try {
      await ctx.reply("🔄 Экспортирую логи показаний...");
      const logService = new LogService(bot);
      const filePath = await logService.exportInsertLogs();
      await ctx.replyWithDocument({ source: filePath });
      await ctx.reply("✅ Логи показаний успешно экспортированы!");
    } catch (error) {
      const logService = new LogService();
      await logService.logError(error, "bot.export_insert", ctx.chat.id, ctx.from.first_name);
      await ctx.reply(`❌ Ошибка при экспорте: ${error.message}`);
    }
  });

  bot.command("export_errors", ensureAuthMiddleware, requireRole(ROLES.ADMIN), async (ctx) => {
    try {
      await ctx.reply("🔄 Экспортирую логи ошибок...");
      const logService = new LogService(bot);
      const filePath = await logService.exportErrorLogs();
      await ctx.replyWithDocument({ source: filePath });
      await ctx.reply("✅ Логи ошибок успешно экспортированы!");
    } catch (error) {
      const logService = new LogService();
      await logService.logError(error, "bot.export_errors", ctx.chat.id, ctx.from.first_name);
      await ctx.reply(`❌ Ошибка при экспорте: ${error.message}`);
    }
  });

  bot.command("export_all", ensureAuthMiddleware, requireRole(ROLES.ADMIN), async (ctx) => {
    try {
      await ctx.reply("🔄 Экспортирую все логи (это может занять время)...");
      const logService = new LogService(bot);
      const filePath = await logService.exportAllLogs();
      await ctx.replyWithDocument({ source: filePath });
      await ctx.reply("✅ Все логи успешно экспортированы!");
    } catch (error) {
      const logService = new LogService();
      await logService.logError(error, "bot.export_all", ctx.chat.id, ctx.from.first_name);
      await ctx.reply(`❌ Ошибка при экспорте: ${error.message}`);
    }
  });

  bot.command("logs_stats", ensureAuthMiddleware, requireRole(ROLES.ADMIN), async (ctx) => {
    try {
      const logService = new LogService();
      const stats = await logService.getStatistics();

      const message = `📊 Статистика логов:

🔍 Логи поиска: ${stats.searchLogs}
📝 Логи показаний: ${stats.insertLogs}
❌ Логи ошибок: ${stats.errorLogs}
━━━━━━━━━━━━━━━━━━
📁 Всего записей: ${stats.total}

Команды экспорта:
/export_search - Экспорт логов поиска
/export_insert - Экспорт логов показаний
/export_errors - Экспорт логов ошибок
/export_all - Экспорт всех логов`;

      await ctx.reply(message);
    } catch (error) {
      const logService = new LogService();
      await logService.logError(error, "bot.logs_stats", ctx.chat.id, ctx.from.first_name);
      await ctx.reply("❌ Ошибка при получении статистики");
    }
  });

  bot.command("photos", async (ctx) => {
    const parts = ctx.message.text.split(" ");
    const conscode = parts[1];

    if (!conscode) {
      return ctx.reply("❗ Укажите ЛСчёт: /photos 44");
    }

    try {
      const photos = await Photo.find({ CONSCODE: conscode });

      if (!photos.length) {
        return ctx.reply("❌ Фото не найдены по этому ЛСчёту");
      }

      for (const photo of photos) {
        await ctx.replyWithPhoto(
          { url: photo.photoUrl },
          { caption: photo.date.toLocaleDateString("ru-RU") }
        );
      }
    } catch (err) {
      console.error("Ошибка при получении фото:", err);
      ctx.reply("⚠️ Произошла ошибка при получении фото.");
    }
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Проверка авторизации через новую систему RBAC
    const user = await User.findOne({ user_id: userId });

    if (!user || user.is_blocked || !user.is_active) {
      return ctx.reply("❌ Вы не авторизованы!");
    }

    const state = user?.state;

    const buttonActions = {
      "🔍 по л/с": { state: "searchbyuser", msg: "Введите л/с:" },
      "🔍 по вм": { state: "searchwm", msg: "Введите номер в/м:" },
      "🔍 по фио": { state: "searchbyname", msg: "Введите фио:" },
    };

    if (buttonActions[text]) {
      const { state, msg } = buttonActions[text];
      await safeReply(ctx, msg, search);
      await User.updateOne({ user_id: userId }, { state });
      return;
    }

    if (stateHandlers[state]) {
      try {
        await stateHandlers[state](text, ctx, user);
      } catch (e) {
        console.error(`Ошибка при обработке состояния ${state}:`, e);
        await safeReply(ctx, "Произошла ошибка при обработке.");
      }
    } else {
      await safeReply(ctx, "Выберите команду....");
    }
  });

  bot.on("photo", async (ctx) => {
    try {
      const user = await User.findOne({ user_id: ctx.from.id });
      if (!user || user.state !== "waiting_photo") return;

      // const conscode = user.conscode || "123456"; // можешь заранее сохранить conscode
      const conscode = user.data?.searchValue;
      await handlePhotoUpload(ctx, conscode, supabase, Photo);

      // Сброс состояния
      user.state = null;
      await user.save();
    } catch (err) {
      console.error("Ошибка при получении фото:", err);
      ctx.reply("⚠️ Не удалось обработать фото");
    }
  });

  bot.action("payments", ensureAuthMiddleware, (ctx) => searchPayment(User, ctx));
  bot.action("cheap", ensureAuthMiddleware, (ctx) => searchCheap(User, ctx));
  bot.action("back", ensureAuthMiddleware, (ctx) => back(User, ctx));
  bot.action("sendPhoto", async (ctx) => {
    try {
      // Удаляем инлайн-кнопки
      await ctx.answerCbQuery();
      // await ctx.editMessageReplyMarkup();

      // Обновляем состояние в MongoDB
      await User.updateOne(
        { user_id: ctx.from.id },
        { state: "waiting_photo" }
      );

      await ctx.reply("📷 Пожалуйста, отправьте фото счётчика");
    } catch (err) {
      console.error("Ошибка в sendPhoto:", err);
      ctx.reply("⚠️ Произошла ошибка");
    }
  });

  bot.action(/searchUser_(.+)/, ensureAuthMiddleware, async (ctx) => {
    const text = ctx.match[1];
    const user = ctx.state.user; // Пользователь из middleware

    // Получить доступные участки из новой системы RBAC
    const accessibleSections = await user.getAccessibleSections();

    let codeArray;
    if (accessibleSections === null) {
      // Админ/Ревизор - доступ ко всем участкам
      codeArray = null;
    } else if (accessibleSections.length === 0) {
      return ctx.reply("❌ У вас нет доступных участков. Обратитесь к администратору.");
    } else {
      codeArray = accessibleSections.map((v) => `'${v}'`).join(",");
    }

    await searchByUser(codeArray, text, ctx, User);
    await User.updateOne({ user_id: ctx.from.id }, { state: "info" });
  });

  bot.action(/^wcode_/, (ctx) => wcodeInfoForInsert(ctx, User));
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

  bot.catch(async (err, ctx) => {
    console.error("Ошибка в боте:", err);

    // Глобальное логирование ошибок
    const logService = new LogService();
    await logService.logError(
      err,
      "bot.globalErrorHandler",
      ctx?.from?.id,
      ctx?.from?.first_name,
      {
        updateType: ctx?.updateType,
        chatId: ctx?.chat?.id,
      }
    );

    ctx.reply?.("Произошла ошибка. Пожалуйста, попробуйте позже.");
  });

  console.log("Bot have been started successfully.");
  return bot;
}

module.exports = botStart;
