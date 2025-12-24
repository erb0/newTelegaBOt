# 🔐 Руководство по миграции на новую систему RBAC авторизации

## 📋 Содержание

1. [Обзор новой системы](#обзор-новой-системы)
2. [Подготовка к миграции](#подготовка-к-миграции)
3. [Шаги миграции](#шаги-миграции)
4. [Интеграция с bot.js](#интеграция-с-botjs)
5. [Тестирование](#тестирование)
6. [Команды управления](#команды-управления)
7. [Откат изменений](#откат-изменений)

---

## 🎯 Обзор новой системы

### Что изменилось?

**Было:**
- Пользователи хардкодены в `modules/auth.js`
- Два объекта: `auth` и `authChatId`
- Изменения требуют редактирования кода и перезапуска

**Стало:**
- Пользователи хранятся в MongoDB
- Гибкая система ролей (RBAC)
- Управление через команды бота
- История всех изменений (audit log)

### Роли пользователей

| Роль | Описание | Права |
|------|----------|-------|
| `admin` | Администратор | Все права + управление пользователями |
| `revisor` | Ревизор | Просмотр всех участков, отчеты |
| `chief` | Начальник участка | Свой сельский округ |
| `controller` | Контролер | Только свои участки |

### Новые возможности

✅ Управление пользователями через бот
✅ Включение/отключение права внесения показаний
✅ Блокировка пользователей
✅ История всех действий
✅ Гибкая система прав

---

## 🛠 Подготовка к миграции

### 1. Backup

```bash
# Backup MongoDB
mongodump --uri="your_mongodb_uri" --out=/backup/mongo_$(date +%Y%m%d)

# Backup кода
cp -r /home/user/newTelegaBOt /backup/newTelegaBOt_$(date +%Y%m%d)
```

### 2. Проверка зависимостей

Все необходимые пакеты уже установлены:
- mongoose
- telegraf
- dotenv

---

## 📦 Шаги миграции

### Шаг 1: Синхронизация участков из Access DB

```bash
cd /home/user/newTelegaBOt
node scripts/syncSections.js
```

**Что делает:**
- Читает таблицу `SECTION` из Access DB
- Создает записи в MongoDB коллекции `sections`
- Синхронизирует коды участков для проверки прав

**Ожидаемый вывод:**
```
🔄 Синхронизация участков из Access DB...
✅ Синхронизация завершена:
   Создано: 95
   Обновлено: 0
   Всего: 95
```

### Шаг 2: Миграция пользователей

```bash
node scripts/migrateUsers.js
```

**Что делает:**
- Читает `modules/auth.js`
- Создает пользователей в MongoDB
- Автоматически определяет роли по названию или количеству участков

**Ожидаемый вывод:**
```
🔄 Начало миграции пользователей из auth.js...
✅ Создан: Админ - Ербол (admin) - участков: 95
✅ Создан: Контролер[Аксукент-2] - Абдурахим (controller) - участков: 6
...
📊 Статистика миграции:
   ✅ Создано: 25
   ⏩ Пропущено: 0
   ❌ Ошибок: 0
```

### Шаг 3: Проверка миграции

Запустите бота и проверьте команду `/users`:

```bash
npm start
```

В боте выполните:
```
/users
```

Вы должны увидеть список всех мигрированных пользователей.

---

## 🔌 Интеграция с bot.js

### Вариант 1: Минимальные изменения (рекомендуется для тестирования)

Добавьте в начало `bot.js`:

```javascript
// В начале файла
const { User } = require('./models/User')
const { ensureAuth, canInsertReadings } = require('./middlewares/auth')
const { setupAdminCommands } = require('./bot-admin')

// После создания бота
function botStart() {
  const bot = new Telegraf(token, {
    handlerTimeout: 300000
  })

  // Подключить команды администратора
  setupAdminCommands(bot)

  // Остальной код...
}
```

### Вариант 2: Полная интеграция

Замените старую систему авторизации:

**Было:**
```javascript
const { authChatId, auth } = require('./modules/auth')

const ensureAuth = async (ctx, next) => {
  if (!authChatId[ctx.from.id]) return ctx.reply("Вы не авторизованы!")
  return next()
}
```

**Стало:**
```javascript
const { ensureAuth, canInsertReadings } = require('./middlewares/auth')
const { User } = require('./models/User')
const { setupAdminCommands } = require('./bot-admin')

// В botStart():
setupAdminCommands(bot)
```

### Обновление команд

**Команда /start:**
```javascript
bot.command('start', async (ctx) => {
  // Старый код с authChatId можно убрать

  let user = await User.findOne({ user_id: ctx.from.id })

  if (!user) {
    // Новые пользователи НЕ создаются автоматически
    return ctx.reply('❌ Вы не авторизованы! Обратитесь к администратору.')
  }

  if (user.is_blocked) {
    return ctx.reply('❌ Ваш аккаунт заблокирован!')
  }

  await ctx.replyWithHTML(
    `Привет ${user.first_name}!\n` +
    `Роль: <b>${user.role}</b>\n\n` +
    `Доступные команды:\n` +
    `/info - Информация об абонентах\n` +
    `/insert - Внесение показаний\n` +
    `/list - Коды контролеров\n` +
    `/didntpay - Списки неоплативших`
  )

  user.state = 'start'
  await user.save()
})
```

**Команда /insert:**
```javascript
bot.command('insert', ensureAuth, canInsertReadings, async (ctx) => {
  const user = ctx.state.user // Пользователь доступен через ctx.state

  await ctx.replyWithHTML(
    `Вы вошли как <i><b>${user.first_name}</b></i>\n` +
    `Роль: <b>${user.role}</b>`
  )

  await User.updateOne({ user_id: ctx.from.id }, { state: 'insertConscode' })
  await ctx.reply('Введите л/с для внесения показаний!', clear())
})
```

**Обновление поиска с учетом прав:**
```javascript
bot.on('text', async (ctx) => {
  const userId = ctx.from.id
  const text = ctx.message.text

  // Получить пользователя
  const user = await User.findOne({ user_id: userId })

  if (!user || user.is_blocked) {
    return ctx.reply('❌ Вы не авторизованы!')
  }

  const state = user.state

  if (state === 'searchbyuser') {
    // Получить доступные участки
    const accessibleSections = await user.getAccessibleSections()

    let locationCodeArray
    if (accessibleSections === null) {
      // Админ/Ревизор - доступ ко всем
      locationCodeArray = null
    } else {
      locationCodeArray = accessibleSections.map(v => `'${v}'`).join(',')
    }

    await searchByUser(locationCodeArray, text, ctx, User)
  }
  // ... остальные состояния
})
```

---

## 🧪 Тестирование

### 1. Проверка базовой авторизации

```bash
# Запустить бота
npm start

# В Telegram:
/start
```

Ожидаемый результат: приветствие с вашей ролью

### 2. Проверка команд администратора

```bash
# В боте (от имени админа):
/users          # Список пользователей
/userinfo 123   # Информация о пользователе
/adminhelp      # Помощь по командам
```

### 3. Проверка прав доступа

Протестируйте от разных пользователей:
- Контролер должен видеть только свои участки
- Ревизор должен видеть все участки
- Заблокированный пользователь не должен иметь доступ

### 4. Проверка внесения показаний

```bash
/insert
# Ввести л/с
# Проверить, что доступ есть только к разрешенным участкам
```

---

## 🎮 Команды управления

### Просмотр пользователей

```
/users                    # Все пользователи
/userinfo <user_id>       # Детальная информация
```

### Создание пользователя

```
/adduser <user_id> <роль> [участки]

Примеры:
/adduser 123456 controller 2301,2302,2303
/adduser 789012 revisor
/adduser 345678 chief
```

### Изменение ролей и прав

```
/setrole <user_id> <роль>

Примеры:
/setrole 123456 admin
/setrole 789012 controller
```

### Управление участками

```
/addsection <user_id> <код>
/removesection <user_id> <код>

Примеры:
/addsection 123456 2305
/removesection 123456 2301
```

### Управление правами

```
/toggleinsert <user_id> <yes|no>

Примеры:
/toggleinsert 123456 no   # Запретить вносить показания
/toggleinsert 123456 yes  # Разрешить вносить показания
```

### Блокировка пользователей

```
/blockuser <user_id>      # Заблокировать
/unblockuser <user_id>    # Разблокировать

Примеры:
/blockuser 123456
/unblockuser 123456
```

---

## 🔄 Откат изменений

Если что-то пошло не так, выполните откат:

### 1. Восстановление из backup

```bash
# Восстановить MongoDB
mongorestore --uri="your_mongodb_uri" /backup/mongo_YYYYMMDD

# Восстановить код
cp -r /backup/newTelegaBOt_YYYYMMDD/* /home/user/newTelegaBOt/
```

### 2. Использование старой системы

Если новая система не работает, можно временно вернуться к старой:

```javascript
// В bot.js закомментировать новый код:
// const { ensureAuth } = require('./middlewares/auth')

// И раскомментировать старый:
const { authChatId } = require('./modules/auth')
const ensureAuth = async (ctx, next) => {
  if (!authChatId[ctx.from.id]) return ctx.reply("Вы не авторизованы!")
  return next()
}
```

---

## ⚠️ Важные замечания

1. **Не удаляйте `modules/auth.js`** сразу - он нужен для миграции
2. **Сделайте backup** перед миграцией
3. **Тестируйте на тестовом боте** перед production
4. **Проверьте все роли** после миграции
5. **Запишите ID админов** - они нужны для восстановления доступа

---

## 🆘 Частые проблемы

### Проблема: "Вы не авторизованы" после миграции

**Решение:** Проверьте, что пользователь создан в MongoDB:
```javascript
// В mongo shell или через бота
db.users.findOne({ user_id: YOUR_ID })
```

### Проблема: Участки не синхронизировались

**Решение:** Проверьте подключение к Access DB и повторно запустите:
```bash
node scripts/syncSections.js
```

### Проблема: Пользователь не может вносить показания

**Решение:** Проверьте флаг `can_insert_readings`:
```bash
/userinfo <user_id>
# Если выключено:
/toggleinsert <user_id> yes
```

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи бота: `pm2 logs bot`
2. Проверьте подключение к MongoDB
3. Проверьте, что все скрипты миграции выполнены
4. Создайте issue с описанием проблемы

---

**Успешной миграции! 🚀**
