# Отчет об исправлении ошибок в TelegaBot

**Дата:** 24 декабря 2025
**Анализ логов:** MongoDB коллекция `errorlogs`
**Найдено ошибок:** 8

---

## Обзор найденных ошибок

### 1. Ошибка в `middlewares/auth.js` (5 случаев)
**Сообщение:** `Cannot read properties of undefined (reading 'role')`
**Контекст:** `bot.globalErrorHandler`
**Строка:** 31

#### Причина:
Функции `requireRole`, `requirePermission`, `canInsertReadings` и `canAccessSection` пытались обратиться к свойствам объекта `ctx.state.user`, но этот объект был `undefined`. Это происходило когда middleware вызывались без предварительного вызова `ensureAuth`, который устанавливает `ctx.state.user`.

#### Исправление:
Добавлена проверка на существование `ctx.state.user` во всех middleware функциях авторизации:

```javascript
// До исправления
function requireRole(...roles) {
  return async (ctx, next) => {
    const user = ctx.state.user
    if (!roles.includes(user.role)) {  // ❌ Ошибка если user === undefined
      return ctx.reply('Недостаточно прав!')
    }
    return next()
  }
}

// После исправления
function requireRole(...roles) {
  return async (ctx, next) => {
    const user = ctx.state.user

    // ✅ Проверка существования пользователя
    if (!user) {
      return ctx.reply('Вы не авторизованы!')
    }

    if (!roles.includes(user.role)) {
      return ctx.reply('Недостаточно прав!')
    }
    return next()
  }
}
```

**Исправленные файлы:**
- `middlewares/auth.js:31-34` - функция `requireRole`
- `middlewares/auth.js:49-52` - функция `requirePermission`
- `middlewares/auth.js:70-73` - функция `canInsertReadings`
- `middlewares/auth.js:87-90` - функция `canAccessSection`

---

### 2. Ошибка в `LogService.js` (3 случая)
**Сообщение:** `Cannot read properties of undefined (reading 'sendMessage')`
**Контекст:** `LogService.logSearch`
**Строка:** 38

#### Причина:
В конструктор `LogService` передавался `bot.telegram` или `ctx.telegram` вместо полного объекта бота. В результате `this.bot` содержал объект `telegram`, а попытка обратиться к `this.bot.telegram` возвращала `undefined`.

#### Исправление:
1. **В LogService.js** - добавлена проверка на существование `this.bot.telegram`:
```javascript
// До исправления
if (this.bot && ctx) {
  await this.bot.telegram.sendMessage(...)  // ❌ Ошибка если this.bot === bot.telegram
}

// После исправления
if (this.bot && this.bot.telegram && ctx) {  // ✅ Проверка существования telegram
  await this.bot.telegram.sendMessage(...)
}
```

2. **В bot.js** - исправлено создание экземпляра LogService:
```javascript
// До исправления
const logService = new LogService(bot.telegram)  // ❌ Неправильно

// После исправления
const logService = new LogService(bot)  // ✅ Правильно
```

3. **В sqlInfo.js и sqlInsert.js** - убран неправильный параметр:
```javascript
// До исправления
const logService = new LogService(ctx.telegram)  // ❌ Неправильно

// После исправления
const logService = new LogService()  // ✅ Правильно
```

**Исправленные файлы:**
- `services/LogService.js:37` - функция `logSearch`
- `services/LogService.js:93` - функция `logInsert`
- `bot.js:184, 198, 212, 226` - команды экспорта логов
- `modules/sqlInfo.js:47, 111` - функции поиска
- `modules/sqlInsert.js:199, 239` - функции вставки показаний

---

### 3. Неправильный порядок параметров в `sqlInfo.js`
**Проблема:** Неправильный порядок параметров при вызове `logService.logSearch`

#### Причина:
Согласно документации, правильный порядок параметров:
```javascript
logSearch(chatId, name, type, data, ctx)
```

Но использовался неправильный порядок:
```javascript
logSearch(chatId, name, searchValue, "Лсчет", ctx)  // ❌ Неправильно
```

#### Исправление:
```javascript
// До исправления
await logService.logSearch(chatId, name, searchValue, "Лсчет", ctx)

// После исправления
await logService.logSearch(chatId, name, "Лсчет", searchValue, ctx)
```

**Исправленные файлы:**
- `modules/sqlInfo.js:48` - функция `searchByUser`
- `modules/sqlInfo.js:112` - функция `searchWmOrName`

---

## Итоги исправлений

### Исправленные файлы (всего 5):
1. ✅ `middlewares/auth.js` - добавлена проверка пользователя в 4 функциях
2. ✅ `services/LogService.js` - добавлена проверка this.bot.telegram
3. ✅ `bot.js` - исправлено создание LogService в 4 командах
4. ✅ `modules/sqlInfo.js` - исправлен порядок параметров и создание LogService
5. ✅ `modules/sqlInsert.js` - исправлено создание LogService в 2 функциях

### Количество исправлений:
- **Критических:** 8 (все исправлены)
- **Файлов изменено:** 5
- **Функций исправлено:** 15+

---

## Рекомендации

### 1. Правильное использование middleware
Всегда используйте `ensureAuth` перед другими middleware авторизации:
```javascript
bot.command("admin_command",
  ensureAuth,               // ← Сначала проверяем авторизацию
  requireRole(ROLES.ADMIN), // ← Потом проверяем роль
  async (ctx) => { ... }
)
```

### 2. Правильное создание LogService
В файлах где есть доступ к объекту `bot`:
```javascript
const logService = new LogService(bot)  // ✅ Передаем bot, не bot.telegram
```

В остальных файлах:
```javascript
const logService = new LogService()  // ✅ Не передаем параметр
```

### 3. Мониторинг логов ошибок
Регулярно проверяйте логи ошибок:
```bash
node scripts/checkErrorLogs.js
```

Или используйте команду бота:
```
/export_errors
```

---

## Проверка исправлений

После внесения изменений рекомендуется:

1. Перезапустить бота
2. Протестировать команды с разными уровнями доступа
3. Проверить логирование поиска и показаний
4. Убедиться что новые ошибки не появляются в MongoDB

---

**Статус:** ✅ Все найденные ошибки исправлены
**Следующий шаг:** Тестирование исправлений в продакшене
