const { Telegraf } = require('telegraf')
require('dotenv').config()
const { connectToDatabase, User, Log, Photo } = require('./modules/mongoDb')
const { search, clear } = require('./modules/button')
const path = require('path')
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')
const {
  connection,
  parseObjText,
  locationCodes,
} = require('./modules/accessDb')
const { didntPay } = require('./modules/reports/didntPay')
const { main } = require('./modules/reports/reportKaspi')
const {
  searchByName,
  searchPayment,
  searchCheap,
  searchByUser,
  searchByWm,
  back,
} = require('./modules/sqlInfo')
const {
  userInfoForInsert,
  wcodeInfoForInsert,
  insertValue,
  insertIfYes,
} = require('./modules/sqlInsert')
const { exportMongoLogsToExcel } = require('./modules/plugin')

const { authChatId, auth } = require('./modules/auth')

connectToDatabase()

function botStart() {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_KEY
  const BUCKET_NAME = process.env.BUCKET_NAME
  const token = process.env.TELEGRAM_TOKEN
  const bot = new Telegraf(token)
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  async function safeReply(ctx, ...args) {
    try {
      await ctx.replyWithHTML(...args)
    } catch (error) {
      if (error.response && error.response.error_code === 403) {
        console.log(`User ${ctx.from.id} blocked the bot.`)
      } else {
        console.error(`Failed to send message to ${ctx.from.id}:`, error)
      }
    }
  }

  const ensureAuth = async (ctx, next) => {
    if (!authChatId[ctx.from.id]) return ctx.reply('Вы не авторизованы!')
    return next()
  }

  const stateHandlers = {
    didntPay: async (text, ctx) => {
      await didntPay(text, ctx, connection)
    },
    list: async (text, ctx) => {
      const message = parseObjText(locationCodes, text)
      if (!message.trim()) return safeReply(ctx, 'Ничего не найдено.')
      const parts = message.match(/.{1,4000}(\n|$)/g)
      for (const part of parts) await safeReply(ctx, part)
    },
    searchbyuser: async (text, ctx, user) => {
      const codes = authChatId[user.user_id]?.section
      if (!codes) return ctx.reply('Нет доступа.')
      const codeArray = codes.map((v) => `'${v}'`).join(',')
      searchByUser(codeArray, text, ctx, User)
    },
    searchwm: (text, ctx) => searchByWm(text, ctx),
    searchbyname: (text, ctx) => searchByName(text, ctx),
    insertConscode: (text, ctx, user) =>
      userInfoForInsert(user.user_id, text, ctx, User),
    insertValue: (text, ctx, user) =>
      insertValue(user.user_id, text, ctx, User),
  }

  bot.command('start', async (ctx) => {
    if (!authChatId[ctx.from.id]) return ctx.reply('Вы не авторизованы!')
    await safeReply(
      ctx,
      `Привет ${ctx.from.first_name || 'unknown'}! Добро пожаловать!
Доступные команды:
/info - Для получение информаций об абонентах
/insert - Для внесение показания абонентов
/list - Коды контролеров
/didntpay - Списки не оплативших абонентов по коду контролера`
    )

    let user = await User.findOne({ user_id: ctx.from.id })
    if (!user) {
      user = new User({
        user_id: ctx.from.id,
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
      await User.updateOne({ user_id: ctx.from.id }, { state: 'start' })
    }
  })

  bot.command('didntpay', ensureAuth, async (ctx) => {
    await safeReply(ctx, `Введите код контролера.\n*коды контролеров /list`)
    await User.updateOne({ user_id: ctx.from.id }, { state: 'didntPay' })
  })

  bot.command('info', ensureAuth, async (ctx) => {
    await safeReply(ctx, 'Выберите тип поиска', search)
  })

  bot.command('list', ensureAuth, async (ctx) => {
    await safeReply(
      ctx,
      'Введите ФИО контролера или наименование сельского округа.'
    )
    await User.updateOne({ user_id: ctx.from.id }, { state: 'list' })
  })

  bot.command('insert', ensureAuth, async (ctx) => {
    const chatId = ctx.chat.id
    await safeReply(
      ctx,
      `Вы вошли как <i><b>${authChatId[chatId].name}</b></i>`
    )
    await User.updateOne({ user_id: ctx.from.id }, { state: 'insertConscode' })
    await safeReply(
      ctx,
      'Введите л/с для внесения показаний счетчиков!',
      clear()
    )
  })

  bot.command('kaspi', async (ctx) => {
    if (ctx.chat.id !== 498318670)
      return await safeReply(ctx, 'У вас нет доступа для этой команды!')
    await main(ctx.chat.id, connection, bot)
  })

  bot.command('mongo', async (ctx) => {
    if (ctx.chat.id !== 498318670)
      return await safeReply(ctx, 'У вас нет доступа для этой команды!')
    await exportMongoLogsToExcel(Log, ctx)
  })

  bot.on('text', async (ctx) => {
    const userId = ctx.from.id
    const text = ctx.message.text
    if (!authChatId[userId]) return ctx.reply('Вы не авторизованы!')

    const user = await User.findOne({ user_id: userId })
    const state = user?.state

    const buttonActions = {
      '🔍 по л/с': { state: 'searchbyuser', msg: 'Введите л/с:' },
      '🔍 по вм': { state: 'searchwm', msg: 'Введите номер в/м:' },
      '🔍 по фио': { state: 'searchbyname', msg: 'Введите фио:' },
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
        await safeReply(ctx, 'Произошла ошибка при обработке.')
      }
    } else {
      await safeReply(ctx, 'Выберите команду....')
    }
  })

  // ==== Обработка фото ====
  bot.on('photo', async (ctx) => {
    try {
      const file = ctx.message.photo.pop()
      const fileId = file.file_id
      const fileLink = await ctx.telegram.getFileLink(fileId)

      const conscode = '123456' // ← можно динамически получить от пользователя
      const now = new Date()
      const fileName = `${conscode}_${now
        .toLocaleDateString('ru-RU')
        .replace(/\//g, '.')}.jpg`

      const response = await axios.get(fileLink.href, {
        responseType: 'arraybuffer',
      })

      // Загрузка в Supabase
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(`meters/${fileName}`, response.data, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (error) {
        console.error('Ошибка Supabase:', error)
        return ctx.reply('❌ Не удалось загрузить фото')
      }

      const { data: publicUrl } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(`meters/${fileName}`)

      // Сохраняем в MongoDB
      await Photo.create({
        chatId: ctx.chat.id,
        name: ctx.message.from.first_name,
        CONSCODE: conscode,
        photoUrl: publicUrl.publicUrl,
        date: now,
      })

      ctx.reply('✅ Фото успешно загружено!')
    } catch (err) {
      console.error('Ошибка:', err)
      ctx.reply('⚠️ Произошла ошибка при загрузке фото')
    }
  })

  bot.action('payments', ensureAuth, (ctx) => searchPayment(User, ctx))
  bot.action('cheap', ensureAuth, (ctx) => searchCheap(User, ctx))
  bot.action('back', ensureAuth, (ctx) => back(User, ctx))

  bot.action(/searchUser_(.+)/, ensureAuth, async (ctx) => {
    const text = ctx.match[1]
    const codes = authChatId[ctx.from.id]?.section
    if (!codes) return ctx.reply('Нет доступа.')
    const codeArray = codes.map((v) => `'${v}'`).join(',')
    searchByUser(codeArray, text, ctx, User)
    await User.updateOne({ user_id: ctx.from.id }, { state: 'info' })
  })

  bot.action(/^wcode_/, (ctx) => wcodeInfoForInsert(ctx, User))
  bot.action('yes', async (ctx) => {
    await ctx.deleteMessage()
    insertIfYes(ctx, User)
  })
  bot.action('restart', async (ctx) => {
    const userId = ctx.chat.id
    await ctx.deleteMessage()
    await User.updateOne({ user_id: userId }, { state: 'insertConscode' })
    await safeReply(ctx, 'Введите л/с!')
  })

  console.log('Bot have been started successfully.')
  return bot
}

module.exports = botStart
