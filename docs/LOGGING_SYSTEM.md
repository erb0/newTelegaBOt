# 📊 Система логирования TelegaBot

## Обзор

Централизованная система логирования для хранения и экспорта всех логов в MongoDB.

---

## 🗂️ Структура коллекций MongoDB

### 1. **logs** - Логи поиска пользователей
Хранит информацию о поисковых запросах пользователей (по л/с, в/м, ФИО).

**Поля:**
- `chatId` (Number) - ID пользователя в Telegram
- `name` (String) - Имя пользователя
- `type` (String) - Тип поиска: "Лсчет", "в/м", "фио"
- `data` (String) - Поисковый запрос
- `timestamp` (Date) - Дата и время запроса

### 2. **insertlogs** - Логи показаний абонентов
Хранит информацию о внесенных показаниях водомеров.

**Поля:**
- `inspectorName` (String) - Имя контролера
- `inspectorId` (Number) - ID контролера
- `conscode` (Number) - Лицевой счет абонента
- `consname` (String) - ФИО абонента
- `streetName` (String) - Улица
- `house` (String) - Дом
- `WCODE` (String) - Код водомера
- `CURRCOUNT` (Number) - Текущие показания
- `LASTCOUNT` (Number) - Последние показания
- `diff` (Number) - Разница показаний
- `timestamp` (Date) - Дата и время внесения

### 3. **errorlogs** - Логи ошибок
Хранит информацию обо всех ошибках в системе.

**Поля:**
- `errorMessage` (String) - Сообщение об ошибке
- `errorStack` (String) - Стек ошибки
- `context` (String) - Функция/модуль где произошла ошибка
- `userId` (Number) - ID пользователя (если применимо)
- `userName` (String) - Имя пользователя (если применимо)
- `additionalData` (Object) - Дополнительные данные
- `timestamp` (Date) - Дата и время ошибки

---

## 🚀 Использование LogService

### Импорт
```javascript
const LogService = require('../services/LogService');
```

### Создание экземпляра
```javascript
// Базовый экземпляр
const logService = new LogService();

// С подключением к боту для отправки уведомлений админу
const logService = new LogService(bot.telegram, adminChatId);
```

### Методы логирования

#### 1. Логирование поиска
```javascript
await logService.logSearch(
  chatId,        // ID пользователя
  name,          // Имя пользователя
  type,          // "Лсчет", "в/м", "фио"
  data,          // Поисковый запрос
  ctx            // Контекст Telegraf (опционально)
);
```

**Пример:**
```javascript
const logService = new LogService(ctx.telegram);
await logService.logSearch(
  ctx.from.id,
  "Иванов Иван",
  "Лсчет",
  "12345",
  ctx
);
```

#### 2. Логирование показаний
```javascript
await logService.logInsert({
  inspectorName: "Иванов Иван",
  inspectorId: 123456789,
  conscode: 12345,
  consname: "Петров Петр",
  streetName: "Ленина",
  house: "10",
  WCODE: "WM123",
  CURRCOUNT: 100,
  LASTCOUNT: 150
}, ctx);
```

#### 3. Логирование ошибок
```javascript
try {
  // ваш код
} catch (error) {
  const logService = new LogService();
  await logService.logError(
    error,                    // Объект ошибки
    "functionName",           // Контекст (функция/модуль)
    userId,                   // ID пользователя (опционально)
    userName,                 // Имя пользователя (опционально)
    { additionalData: "..." } // Дополнительные данные (опционально)
  );
}
```

### Методы экспорта

#### 1. Экспорт логов поиска
```javascript
const logService = new LogService();
const filePath = await logService.exportSearchLogs();
// Возвращает путь к Excel файлу
```

**С фильтрами:**
```javascript
const filePath = await logService.exportSearchLogs({
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  userId: 123456789,
  type: "Лсчет"
});
```

#### 2. Экспорт логов показаний
```javascript
const filePath = await logService.exportInsertLogs({
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  inspectorId: 123456789,
  inspectorName: "Иванов",
  conscode: 12345
});
```

#### 3. Экспорт логов ошибок
```javascript
const filePath = await logService.exportErrorLogs({
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  userId: 123456789,
  context: "searchByUser"
});
```

#### 4. Экспорт всех логов
```javascript
const filePath = await logService.exportAllLogs({
  startDate: "2025-01-01",
  endDate: "2025-01-31"
});
// Создает один Excel файл с тремя листами
```

#### 5. Получение статистики
```javascript
const stats = await logService.getStatistics();
console.log(stats);
// {
//   searchLogs: 1500,
//   insertLogs: 300,
//   errorLogs: 10,
//   total: 1810
// }
```

---

## 🤖 Команды бота для администраторов

### Команды экспорта логов

| Команда | Описание |
|---------|----------|
| `/export_search` | Экспорт всех логов поиска в Excel |
| `/export_insert` | Экспорт всех логов показаний в Excel |
| `/export_errors` | Экспорт всех логов ошибок в Excel |
| `/export_all` | Экспорт всех логов в один Excel файл (3 листа) |
| `/logs_stats` | Статистика по всем логам |

### Доступ к командам
Все команды экспорта доступны только пользователям с ролью **ADMIN**.

---

## 📁 Структура файлов

```
devTelegaBot/
├── services/
│   └── LogService.js           # Централизованный сервис логирования
├── modules/
│   ├── mongoDb.js              # Схемы MongoDB (Log, InsertLog, ErrorLog)
│   ├── sqlInfo.js              # Использует LogService для поиска
│   └── sqlInsert.js            # Использует LogService для показаний
├── bot.js                      # Команды экспорта и глобальный обработчик ошибок
└── docs/
    └── LOGGING_SYSTEM.md       # Эта документация
```

---

## 🔥 Преимущества новой системы

1. ✅ **Централизация** - Единый интерфейс для всех типов логов
2. ✅ **MongoDB вместо Excel** - Быстрый поиск и фильтрация
3. ✅ **Автоматическое логирование ошибок** - Глобальный обработчик
4. ✅ **Гибкие фильтры** - Экспорт по дате, пользователю, типу
5. ✅ **Статистика** - Мгновенный доступ к количеству логов
6. ✅ **Уведомления админу** - При критических событиях (разница >100 м3)
7. ✅ **Легкость расширения** - Легко добавлять новые типы логов

---

## 📝 Примеры использования

### Пример 1: Логирование поиска в функции
```javascript
async function searchByUser(locationCodeArray, searchValue, ctx, User) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });

    // Логирование
    const logService = new LogService(ctx.telegram);
    await logService.logSearch(chatId, user.first_name, "Лсчет", searchValue, ctx);

    // ... остальная логика
  } catch (error) {
    const logService = new LogService();
    await logService.logError(error, "searchByUser", ctx.from.id, user?.first_name);
  }
}
```

### Пример 2: Логирование показаний
```javascript
async function insertValue(chatId, text, ctx, User) {
  try {
    const user = await User.findOne({ user_id: chatId });
    const LASTCOUNT = Number(text);
    const { CURRCOUNT, WCODE } = user.data;

    // Вставка в БД
    await insertWcheapEntry(WCODE, LASTCOUNT, CURRCOUNT);

    // Логирование
    const logService = new LogService(ctx.telegram);
    await logService.logInsert({
      inspectorName: user.first_name,
      inspectorId: chatId,
      conscode: user.data.conscode,
      consname: user.data.consname,
      streetName: user.data.streetName,
      house: user.data.house,
      WCODE,
      CURRCOUNT,
      LASTCOUNT,
    }, ctx);

  } catch (error) {
    const logService = new LogService();
    await logService.logError(error, "insertValue", chatId, user?.first_name);
  }
}
```

### Пример 3: Экспорт логов через команду бота
```javascript
bot.command("export_search", ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
  try {
    await ctx.reply("🔄 Экспортирую логи поиска...");
    const logService = new LogService(bot.telegram);
    const filePath = await logService.exportSearchLogs();
    await ctx.replyWithDocument({ source: filePath });
    await ctx.reply("✅ Логи успешно экспортированы!");
  } catch (error) {
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
});
```

---

## 🛠️ Миграция со старой системы

### Что изменилось:

| Старая система | Новая система |
|----------------|---------------|
| `logInfo()` в plugin.js | `logService.logSearch()` |
| `logInfoMongo()` в mongoDb.js | `logService.logSearch()` |
| `log()` в plugin.js | `logService.logInsert()` |
| Excel файлы в modules/log/ | MongoDB коллекции |
| `console.error()` | `logService.logError()` |
| `/mongo` команда | `/export_search`, `/export_insert`, `/export_errors`, `/export_all` |

### Старые Excel файлы

Старые Excel файлы в `modules/log/` можно удалить после проверки новой системы:
- `log.xlsx` - логи поиска
- `{inspectorName}.xlsx` - логи показаний

---

## ⚠️ Важные замечания

1. **Производительность**: Логирование происходит асинхронно и не блокирует основные операции
2. **Обработка ошибок**: Если логирование не удалось, ошибка выводится в консоль, но не прерывает работу
3. **Размер файлов**: При большом количестве логов экспорт может занять время
4. **Очистка логов**: Рекомендуется периодически архивировать старые логи

---

## 📞 Контакты

По вопросам работы системы логирования обращайтесь к администратору проекта.
