const { Telegraf } = require('telegraf')
require('dotenv').config()
const { connectToDatabase, User } = require('./modules/mongoDb')
const { search } = require('./modules/infoModules/options')
const {
  searchByName,
  searchPayment,
  searchCheap,
  searchByUser,
  searchByWm,
} = require('./modules/infoModules/sqlQuery')

connectToDatabase()

const token = process.env.TELEGRAM_TOKEN
const bot = new Telegraf(token)

const cmd = ['start', 'settings', 'info']

bot.command(cmd, async (ctx) => {
  const userId = ctx.from.id
  const command = ctx.message.text.split(' ')[0]

  switch (command) {
    case '/start':
      ctx.reply('Привет! Добро пожаловать!')

      let user = await User.findOne({ user_id: userId })

      if (!user) {
        user = new User({
          user_id: userId,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
          language_code: ctx.from.language_code,
          state: 'start',
          privileges: 'user',
          created_at: new Date(),
        })
        await user.save()
      } else {
        await User.updateOne({ user_id: userId }, { state: 'start' })
      }
      break
    case '/settings':
      ctx.reply('Вы вошли в настройки.')
      await User.updateOne({ user_id: userId }, { state: 'settings' })
      break
    case '/info':
      ctx.replyWithHTML('Выберите тип поиска', search)
      await User.updateOne({ user_id: userId }, { state: 'info' })
      break
    default:
      ctx.reply('Неизвестная команда.')
  }
})

bot.on('text', async (ctx) => {
  const userId = ctx.from.id
  const user = await User.findOne({ user_id: userId })
  const text = ctx.message.text

  switch (user.state) {
    case 'start':
      user.data = { ...user.data, startMessage: text }
      await user.save()
      ctx.reply('Вы находитесь в start. ' + text)
      if (user.data.settingsMessage) {
        ctx.reply('text settings ' + user.data.settingsMessage)
      }
      break
    case 'settings':
      user.data = { ...user.data, settingsMessage: text }
      await user.save()
      ctx.reply('Вы находитесь в настройках. ' + text)
      if (user.data.startMessage)
        ctx.reply('text start ' + user.data.startMessage)
      break
    case 'info':
      switch (text) {
        case '🔍 по л/с':
          ctx.replyWithHTML('Введите л/с:', search)
          await User.updateOne({ user_id: userId }, { state: 'searchbyuser' })
          break
        default:
          ctx.reply('Выберите команду....')
      }
      break
    case 'searchbyuser':
      searchByUser(text, ctx, User)
      break
    default:
      ctx.reply('Ошибка....')
  }
})

bot.action('payments', (ctx) => {
  searchPayment(User, ctx)
})
bot.action('cheap', (ctx) => {
  searchCheap(User, ctx)
})

bot.launch()
