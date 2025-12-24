/**
 * Модуль с командами администратора для управления пользователями
 * Добавьте эти команды в ваш основной bot.js
 */

const { ensureAuth, requireRole, canInsertReadings } = require('./middlewares/auth')
const { ROLES } = require('./models/User')
const userService = require('./services/userService')

function setupAdminCommands(bot) {

  // === КОМАНДЫ АДМИНИСТРАТОРА ===

  // Список пользователей
  bot.command('users', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    try {
      const users = await userService.listUsers()

      if (users.length === 0) {
        return ctx.reply('📝 Нет пользователей в системе')
      }

      let message = '👥 <b>Список пользователей:</b>\n\n'

      for (const user of users) {
        const status = user.is_blocked ? '🔴' : '🟢'
        const insertIcon = user.can_insert_readings ? '✅' : '❌'
        const roleNames = {
          admin: 'Админ',
          revisor: 'Ревизор',
          chief: 'Начальник',
          controller: 'Контролер'
        }

        message += `${status} <b>${user.first_name}</b>\n`
        message += `   ID: <code>${user.user_id}</code>\n`
        message += `   Роль: <b>${roleNames[user.role] || user.role}</b>\n`
        message += `   Внесение показаний: ${insertIcon}\n`
        message += `   Участков: ${user.sections.length}\n\n`
      }

      await ctx.replyWithHTML(message)
    } catch (err) {
      console.error('Ошибка команды users:', err)
      ctx.reply('❌ Ошибка получения списка пользователей')
    }
  })

  // Информация о пользователе
  bot.command('userinfo', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 2) {
      return ctx.reply('Использование: /userinfo <user_id>')
    }

    const userId = parseInt(args[1])

    try {
      const user = await userService.getUser(userId)

      if (!user) {
        return ctx.reply('❌ Пользователь не найден')
      }

      const roleNames = {
        admin: 'Админ',
        revisor: 'Ревизор',
        chief: 'Начальник',
        controller: 'Контролер'
      }

      let message = `👤 <b>Информация о пользователе</b>\n\n`
      message += `ID: <code>${user.user_id}</code>\n`
      message += `Имя: <b>${user.first_name}</b>\n`
      message += `Username: @${user.username || 'нет'}\n`
      message += `Роль: <b>${roleNames[user.role]}</b>\n`
      message += `Внесение показаний: ${user.can_insert_readings ? '✅' : '❌'}\n`
      message += `Статус: ${user.is_blocked ? '🔴 Заблокирован' : '🟢 Активен'}\n`
      message += `Участков: ${user.sections.length}\n`
      message += `Последний вход: ${user.last_login ? user.last_login.toLocaleString('ru-RU') : 'никогда'}\n`

      if (user.sections.length > 0 && user.sections.length <= 10) {
        message += `\nУчастки: ${user.sections.join(', ')}`
      }

      await ctx.replyWithHTML(message)
    } catch (err) {
      console.error('Ошибка команды userinfo:', err)
      ctx.reply('❌ Ошибка получения информации')
    }
  })

  // Добавить пользователя
  bot.command('adduser', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length < 3) {
      return ctx.replyWithHTML(
        '<b>Использование:</b>\n' +
        '/adduser &lt;user_id&gt; &lt;роль&gt; [участки]\n\n' +
        '<b>Роли:</b>\n' +
        '• admin - администратор\n' +
        '• revisor - ревизор\n' +
        '• chief - начальник участка\n' +
        '• controller - контролер\n\n' +
        '<b>Пример:</b>\n' +
        '/adduser 123456 controller 2301,2302'
      )
    }

    const [_, userId, role, sectionsStr] = args
    const sections = sectionsStr ? sectionsStr.split(',').map(Number) : []

    try {
      await userService.createUser(
        {
          user_id: parseInt(userId),
          role,
          sections,
          first_name: 'Новый пользователь'
        },
        ctx.from.id
      )

      ctx.reply(`✅ Пользователь ${userId} создан с ролью ${role}`)
    } catch (err) {
      console.error('Ошибка команды adduser:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Изменить роль
  bot.command('setrole', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 3) {
      return ctx.replyWithHTML(
        '<b>Использование:</b> /setrole &lt;user_id&gt; &lt;роль&gt;\n\n' +
        '<b>Роли:</b> admin, revisor, chief, controller'
      )
    }

    const [_, userId, role] = args

    try {
      await userService.updateRole(parseInt(userId), role, ctx.from.id)
      ctx.reply(`✅ Роль пользователя ${userId} изменена на ${role}`)
    } catch (err) {
      console.error('Ошибка команды setrole:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Добавить участок
  bot.command('addsection', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 3) {
      return ctx.reply('Использование: /addsection <user_id> <код_участка>')
    }

    const [_, userId, sectionCode] = args

    try {
      await userService.addSection(
        parseInt(userId),
        parseInt(sectionCode),
        ctx.from.id
      )
      ctx.reply(`✅ Участок ${sectionCode} добавлен пользователю ${userId}`)
    } catch (err) {
      console.error('Ошибка команды addsection:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Удалить участок
  bot.command('removesection', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 3) {
      return ctx.reply('Использование: /removesection <user_id> <код_участка>')
    }

    const [_, userId, sectionCode] = args

    try {
      await userService.removeSection(
        parseInt(userId),
        parseInt(sectionCode),
        ctx.from.id
      )
      ctx.reply(`✅ Участок ${sectionCode} удален у пользователя ${userId}`)
    } catch (err) {
      console.error('Ошибка команды removesection:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Включить/выключить внесение показаний
  bot.command('toggleinsert', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 3) {
      return ctx.reply('Использование: /toggleinsert <user_id> <yes|no>')
    }

    const [_, userId, canInsert] = args
    const canInsertBool = canInsert.toLowerCase() === 'yes'

    try {
      await userService.toggleInsertReadings(
        parseInt(userId),
        canInsertBool,
        ctx.from.id
      )
      ctx.reply(
        `✅ Внесение показаний для ${userId}: ${canInsertBool ? 'включено ✅' : 'выключено ❌'}`
      )
    } catch (err) {
      console.error('Ошибка команды toggleinsert:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Заблокировать пользователя
  bot.command('blockuser', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 2) {
      return ctx.reply('Использование: /blockuser <user_id>')
    }

    const userId = parseInt(args[1])

    try {
      await userService.toggleBlock(userId, true, ctx.from.id)
      ctx.reply(`✅ Пользователь ${userId} заблокирован 🔴`)
    } catch (err) {
      console.error('Ошибка команды blockuser:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Разблокировать пользователя
  bot.command('unblockuser', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const args = ctx.message.text.split(' ')

    if (args.length !== 2) {
      return ctx.reply('Использование: /unblockuser <user_id>')
    }

    const userId = parseInt(args[1])

    try {
      await userService.toggleBlock(userId, false, ctx.from.id)
      ctx.reply(`✅ Пользователь ${userId} разблокирован 🟢`)
    } catch (err) {
      console.error('Ошибка команды unblockuser:', err)
      ctx.reply(`❌ Ошибка: ${err.message}`)
    }
  })

  // Помощь по командам администратора
  bot.command('adminhelp', ensureAuth, requireRole(ROLES.ADMIN), async (ctx) => {
    const message = `
<b>📋 Команды администратора</b>

<b>Просмотр:</b>
/users - список всех пользователей
/userinfo &lt;user_id&gt; - информация о пользователе

<b>Управление пользователями:</b>
/adduser &lt;user_id&gt; &lt;роль&gt; [участки] - создать пользователя
/setrole &lt;user_id&gt; &lt;роль&gt; - изменить роль

<b>Управление участками:</b>
/addsection &lt;user_id&gt; &lt;код&gt; - добавить участок
/removesection &lt;user_id&gt; &lt;код&gt; - удалить участок

<b>Права:</b>
/toggleinsert &lt;user_id&gt; &lt;yes|no&gt; - право внесения показаний

<b>Блокировка:</b>
/blockuser &lt;user_id&gt; - заблокировать
/unblockuser &lt;user_id&gt; - разблокировать

<b>Роли:</b>
• admin - администратор (все права)
• revisor - ревизор (просмотр всех, отчеты)
• chief - начальник участка (свой округ)
• controller - контролер (свои участки)
`
    await ctx.replyWithHTML(message)
  })
}

module.exports = { setupAdminCommands }
