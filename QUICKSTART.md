# 🚀 Быстрый старт - Система RBAC

## ⚡ Установка за 5 минут

### Шаг 1: Миграция данных (2 мин)

```bash
cd /home/user/newTelegaBOt

# Синхронизировать участки
node scripts/syncSections.js

# Мигрировать пользователей
node scripts/migrateUsers.js
```

### Шаг 2: Интеграция с ботом (3 мин)

**Добавьте в начало bot.js:**

```javascript
const { User, ROLES } = require('./models/User')
const { ensureAuth, canInsertReadings, requireRole } = require('./middlewares/auth')
const { setupAdminCommands } = require('./bot-admin')
```

**В функции botStart() после создания бота:**

```javascript
setupAdminCommands(bot)
```

**Обновите /start, /insert и обработчик текста** - см. INTEGRATION_EXAMPLE.md

### Шаг 3: Запуск (30 сек)

```bash
npm start
# или
pm2 restart bot
```

### Шаг 4: Проверка (30 сек)

В Telegram боте:
```
/start
/users         # Список пользователей (только админ)
/adminhelp     # Помощь по командам
```

---

## 📦 Что в архиве rbac-system.zip?

```
models/
  ├── User.js           # Модель пользователя с ролями
  ├── Section.js        # Модель участков
  └── AuditLog.js       # Модель логов действий

services/
  └── userService.js    # Сервис управления пользователями

middlewares/
  └── auth.js           # Middleware авторизации

scripts/
  ├── syncSections.js   # Синхронизация участков
  └── migrateUsers.js   # Миграция пользователей

bot-admin.js            # Команды администратора
MIGRATION_GUIDE.md      # Полное руководство
INTEGRATION_EXAMPLE.md  # Примеры интеграции
```

---

## 🎮 Основные команды

### Для всех пользователей:
```
/start       # Запуск бота
/info        # Поиск абонентов
/insert      # Внесение показаний (если есть право)
/list        # Коды контролеров
/didntpay    # Неоплатившие
```

### Для администраторов:
```
/users                          # Все пользователи
/userinfo <id>                  # Информация
/adduser <id> <роль> [участки]  # Создать
/setrole <id> <роль>            # Изменить роль
/addsection <id> <код>          # Добавить участок
/removesection <id> <код>       # Удалить участок
/toggleinsert <id> <yes|no>     # Право внесения
/blockuser <id>                 # Заблокировать
/unblockuser <id>               # Разблокировать
/adminhelp                      # Помощь
```

---

## 🔑 Роли

| Роль | Доступ | Примеры |
|------|--------|---------|
| `admin` | Все участки + управление | Ербол, Аман |
| `revisor` | Все участки (только просмотр) | Жамшид, Сапар |
| `chief` | Свой сельский округ | Начальники участков |
| `controller` | Только свои участки | Абдурахим, Агабек |

---

## ❓ FAQ

**Q: Как добавить нового пользователя?**
```
/adduser 123456789 controller 2301,2302
```

**Q: Как запретить вносить показания?**
```
/toggleinsert 123456789 no
```

**Q: Как дать доступ ко всем участкам?**
```
/setrole 123456789 revisor
```

**Q: Где посмотреть историю действий?**
В MongoDB коллекция `audit_logs`

---

## 🆘 Проблемы?

1. **Проверьте логи:** `pm2 logs bot`
2. **Проверьте MongoDB:** убедитесь что пользователи созданы
3. **Проверьте миграцию:** `node scripts/migrateUsers.js`
4. **См. MIGRATION_GUIDE.md** для детальной информации

---

## 📞 Поддержка

- Полное руководство: **MIGRATION_GUIDE.md**
- Примеры интеграции: **INTEGRATION_EXAMPLE.md**
- Тестирование: запустите миграцию и проверьте `/users`

**Успехов! 🎉**
