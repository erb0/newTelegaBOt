const { User, ROLES, PERMISSIONS } = require('../models/User')

// Базовая авторизация
async function ensureAuth(ctx, next) {
  const userId = ctx.from.id
  const user = await User.findOne({
    user_id: userId,
    is_active: true,
    is_blocked: false
  })

  if (!user) {
    return ctx.reply('❌ Вы не авторизованы!')
  }

  // Обновить время последнего входа
  user.last_login = new Date()
  await user.save()

  // Добавить пользователя в контекст
  ctx.state.user = user

  return next()
}

// Проверка роли
function requireRole(...roles) {
  return async (ctx, next) => {
    const user = ctx.state.user

    // Проверка что пользователь существует
    if (!user) {
      return ctx.reply('❌ Вы не авторизованы!')
    }

    if (!roles.includes(user.role)) {
      return ctx.reply('❌ Недостаточно прав!')
    }

    return next()
  }
}

// Проверка права
function requirePermission(...permissions) {
  return async (ctx, next) => {
    const user = ctx.state.user

    // Проверка что пользователь существует
    if (!user) {
      return ctx.reply('❌ Вы не авторизованы!')
    }

    const hasPermission = permissions.some(perm =>
      user.permissions.includes(perm)
    )

    if (!hasPermission) {
      return ctx.reply('❌ Недостаточно прав для этой операции!')
    }

    return next()
  }
}

// Проверка возможности вносить показания
function canInsertReadings(ctx, next) {
  const user = ctx.state.user

  // Проверка что пользователь существует
  if (!user) {
    return ctx.reply('❌ Вы не авторизованы!')
  }

  if (!user.can_insert_readings) {
    return ctx.reply('❌ У вас нет права вносить показания!')
  }

  return next()
}

// Проверка доступа к участку
function canAccessSection(sectionCode) {
  return async (ctx, next) => {
    const user = ctx.state.user

    // Проверка что пользователь существует
    if (!user) {
      return ctx.reply('❌ Вы не авторизованы!')
    }

    if (await user.canAccessSection(sectionCode)) {
      return next()
    }

    return ctx.reply('❌ Нет доступа к этому участку!')
  }
}

module.exports = {
  ensureAuth,
  requireRole,
  requirePermission,
  canInsertReadings,
  canAccessSection
}
