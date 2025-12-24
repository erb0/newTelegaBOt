# Пример интеграции новой системы авторизации

## 📝 Быстрая интеграция

### 1. Добавьте в начало bot.js:

```javascript
// ========== НОВАЯ СИСТЕМА RBAC ==========
const { User } = require('./models/User')
const { ensureAuth, canInsertReadings, requireRole } = require('./middlewares/auth')
const { setupAdminCommands } = require('./bot-admin')
const { ROLES } = require('./models/User')
// ========================================
```

### 2. В функции botStart() после создания бота:

```javascript
function botStart() {
  const bot = new Telegraf(token, {
    handlerTimeout: 300000,
  });

  // ========== ДОБАВИТЬ ЭТУ СТРОКУ ==========
  setupAdminCommands(bot)
  // =========================================

  // Остальной код...
}
```

### 3. Обновить команду /start:

```javascript
bot.command("start", async (ctx) => {
  // ========== НОВЫЙ КОД ==========
  let user = await User.findOne({ user_id: ctx.from.id })

  if (!user) {
    return ctx.reply('❌ Вы не авторизованы! Обратитесь к администратору.')
  }

  if (user.is_blocked) {
    return ctx.reply('❌ Ваш аккаунт заблокирован!')
  }

  await ctx.replyWithHTML(
    `Привет ${user.first_name}! Добро пожаловать!\n` +
    `Роль: <b>${user.role}</b>\n\n` +
    `Доступные команды:\n` +
    `/info - Для получение информаций об абонентах\n` +
    `/insert - Для внесение показания абонентов\n` +
    `/list - Коды контролеров\n` +
    `/didntpay - Списки не оплативших абонентов по коду контролера`
  )

  user.state = 'start'
  await user.save()
  // ===============================
});
```

### 4. Обновить команду /insert:

```javascript
bot.command("insert", ensureAuth, canInsertReadings, async (ctx) => {
  const user = ctx.state.user // Пользователь доступен через ctx.state
  const chatId = ctx.chat.id

  await ctx.replyWithHTML(
    `Вы вошли как <i><b>${user.first_name}</b></i>\n` +
    `Роль: <b>${user.role}</b>`
  )

  await User.updateOne({ user_id: ctx.from.id }, { state: "insertConscode" })
  await ctx.reply("Введите л/с для внесения показаний счетчиков!", clear())
});
```

### 5. Обновить обработчик текста для поиска:

```javascript
bot.on("text", async (ctx) => {
  const userId = ctx.from.id
  const text = ctx.message.text

  // ========== НОВЫЙ КОД ==========
  const user = await User.findOne({ user_id: userId })

  if (!user || user.is_blocked) {
    return ctx.reply('❌ Вы не авторизованы!')
  }
  // ===============================

  const state = user?.state

  const buttonActions = {
    "🔍 по л/с": { state: "searchbyuser", msg: "Введите л/с:" },
    "🔍 по вм": { state: "searchwm", msg: "Введите номер в/м:" },
    "🔍 по фио": { state: "searchbyname", msg: "Введите фио:" },
  }

  if (buttonActions[text]) {
    const { state, msg } = buttonActions[text]
    await safeReply(ctx, msg, search)
    await User.updateOne({ user_id: userId }, { state })
    return
  }

  if (stateHandlers[state]) {
    try {
      await stateHandlers[state](text, ctx, user)
    } catch (e) {
      console.error(`Ошибка при обработке состояния ${state}:`, e)
      await safeReply(ctx, "Произошла ошибка при обработке.")
    }
  } else {
    await safeReply(ctx, "Выберите команду....")
  }
});
```

### 6. Обновить обработчик состояния searchbyuser:

```javascript
const stateHandlers = {
  didntPay: async (text, ctx) => {
    await didntPay(text, ctx, connection)
  },
  list: async (text, ctx) => {
    const message = parseObjText(locationCodes, text)
    if (!message.trim()) return safeReply(ctx, "Ничего не найдено.")
    const parts = message.match(/.{1,4000}(\n|$)/g)
    for (const part of parts) await safeReply(ctx, part)
  },
  // ========== ОБНОВЛЕННЫЙ КОД ==========
  searchbyuser: async (text, ctx, user) => {
    // Получить доступные участки с учетом роли
    const accessibleSections = await user.getAccessibleSections()

    let codeArray
    if (accessibleSections === null) {
      // Админ/Ревизор - все участки, не фильтруем
      // В этом случае нужно получить ВСЕ коды из базы
      const allCodes = Object.keys(locationCodes).map(v => `'${v}'`).join(',')
      codeArray = allCodes
    } else {
      // Фильтруем по доступным участкам
      codeArray = accessibleSections.map(v => `'${v}'`).join(',')
    }

    searchByUser(codeArray, text, ctx, User)
  },
  // ====================================
  searchwm: (text, ctx) => searchByWm(text, ctx),
  searchbyname: (text, ctx) => searchByName(text, ctx),
  insertConscode: (text, ctx, user) =>
    userInfoForInsert(user.user_id, text, ctx, User),
  insertValue: (text, ctx, user) =>
    insertValue(user.user_id, text, ctx, User),
}
```

### 7. Убрать старые проверки authChatId

**Найдите и УДАЛИТЕ или ЗАКОММЕНТИРУЙТЕ:**

```javascript
// ❌ УДАЛИТЬ ЭТО:
const ensureAuth = async (ctx, next) => {
  if (!authChatId[ctx.from.id]) return ctx.reply("Вы не авторизованы!");
  return next();
};

// ❌ УДАЛИТЬ ЭТО:
if (!authChatId[userId]) return ctx.reply("Вы не авторизованы!")

// ❌ УДАЛИТЬ ЭТО (в команде /kaspi и /mongo):
if (ctx.chat.id !== 498318670)
```

**Заменить на:**

```javascript
// ✅ НОВЫЙ КОД для /kaspi и /mongo:
bot.command('kaspi', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
  await main(ctx.chat.id, connection, bot)
})

bot.command('mongo', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
  await exportMongoLogsToExcel(Log, ctx)
})
```

---

## 🔥 Полный пример измененного bot.js (фрагмент)

```javascript
const { Telegraf } = require("telegraf");
require("dotenv").config();
const { connectToDatabase, Log, Photo } = require("./modules/mongoDb");
const { search, clear } = require("./modules/button");

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
const { exportMongoLogsToExcel } = require("./modules/plugin");

// ========== НОВАЯ СИСТЕМА RBAC ==========
const { User, ROLES } = require('./models/User')
const { ensureAuth, canInsertReadings, requireRole } = require('./middlewares/auth')
const { setupAdminCommands } = require('./bot-admin')
// ========================================

connectToDatabase();

function botStart() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BUCKET_NAME = process.env.BUCKET_NAME;
  const token = process.env.TELEGRAM_TOKEN;
  const bot = new Telegraf(token, {
    handlerTimeout: 300000,
  });
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ========== ПОДКЛЮЧЕНИЕ АДМИН-КОМАНД ==========
  setupAdminCommands(bot)
  // =============================================

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
      const accessibleSections = await user.getAccessibleSections()

      let codeArray
      if (accessibleSections === null) {
        const allCodes = Object.keys(locationCodes).map(v => `'${v}'`).join(',')
        codeArray = allCodes
      } else {
        codeArray = accessibleSections.map(v => `'${v}'`).join(',')
      }

      searchByUser(codeArray, text, ctx, User)
    },
    searchwm: (text, ctx) => searchByWm(text, ctx),
    searchbyname: (text, ctx) => searchByName(text, ctx),
    insertConscode: (text, ctx, user) =>
      userInfoForInsert(user.user_id, text, ctx, User),
    insertValue: (text, ctx, user) =>
      insertValue(user.user_id, text, ctx, User),
  };

  bot.command("start", async (ctx) => {
    let user = await User.findOne({ user_id: ctx.from.id })

    if (!user) {
      return ctx.reply('❌ Вы не авторизованы! Обратитесь к администратору.')
    }

    if (user.is_blocked) {
      return ctx.reply('❌ Ваш аккаунт заблокирован!')
    }

    await ctx.replyWithHTML(
      `Привет ${user.first_name}! Добро пожаловать!\n` +
      `Роль: <b>${user.role}</b>\n\n` +
      `Доступные команды:\n` +
      `/info - Для получение информаций об абонентах\n` +
      `/insert - Для внесение показания абонентов\n` +
      `/list - Коды контролеров\n` +
      `/didntpay - Списки не оплативших абонентов по коду контролера`
    )

    user.state = 'start'
    await user.save()
  });

  bot.command("didntpay", ensureAuth, async (ctx) => {
    await safeReply(ctx, `Введите код контролера.\n*коды контролеров /list`);
    await User.updateOne({ user_id: ctx.from.id }, { state: "didntPay" });
  });

  bot.command("info", ensureAuth, async (ctx) => {
    await safeReply(ctx, "Выберите тип поиска", search);
  });

  bot.command("list", ensureAuth, async (ctx) => {
    await safeReply(
      ctx,
      "Введите ФИО контролера или наименование сельского округа."
    );
    await User.updateOne({ user_id: ctx.from.id }, { state: "list" });
  });

  bot.command("insert", ensureAuth, canInsertReadings, async (ctx) => {
    const user = ctx.state.user
    const chatId = ctx.chat.id

    await safeReply(
      ctx,
      `Вы вошли как <i><b>${user.first_name}</b></i>\n` +
      `Роль: <b>${user.role}</b>`
    )

    await User.updateOne({ user_id: ctx.from.id }, { state: "insertConscode" })
    await safeReply(ctx, "Введите л/с для внесения показаний счетчиков!", clear())
  });

  bot.command('kaspi', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    await main(ctx.chat.id, connection, bot)
  })

  bot.command('mongo', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    await exportMongoLogsToExcel(Log, ctx)
  })

  // ... остальной код без изменений

  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    const user = await User.findOne({ user_id: userId })

    if (!user || user.is_blocked) {
      return ctx.reply('❌ Вы не авторизованы!')
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

  // ... остальной код

  console.log("Bot have been started successfully.");
  return bot;
}

module.exports = botStart;
```

---

## ✅ Проверочный список

- [ ] Добавлены импорты новой системы
- [ ] Вызван setupAdminCommands(bot)
- [ ] Обновлена команда /start
- [ ] Обновлена команда /insert с middleware
- [ ] Обновлен обработчик текста с проверкой user
- [ ] Обновлен searchbyuser с getAccessibleSections()
- [ ] Удалены старые проверки authChatId
- [ ] Обновлены команды /kaspi и /mongo с requireRole
- [ ] Запущена миграция пользователей
- [ ] Протестированы все команды

---

**Готово! Система авторизации обновлена! 🎉**
