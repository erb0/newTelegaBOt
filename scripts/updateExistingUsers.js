const { User, ROLES } = require('../models/User')
const { authChatId } = require('../modules/auth')
const { connectToDatabase } = require('../modules/mongoDb')

/**
 * Скрипт для обновления СУЩЕСТВУЮЩИХ пользователей
 * Добавляет новые поля (role, sections, permissions) к старым пользователям
 */
async function updateExistingUsers() {
  console.log('🔄 Обновление существующих пользователей...')

  let updated = 0
  let notFound = 0
  let errors = 0

  for (const [userId, data] of Object.entries(authChatId)) {
    const userIdNum = parseInt(userId)

    try {
      // Найти существующего пользователя
      const user = await User.findOne({ user_id: userIdNum })

      if (!user) {
        console.log(`⏩ Пользователь ${userId} (${data.name}) не найден в базе - пропускаем`)
        notFound++
        continue
      }

      // Проверить, уже ли обновлен (есть ли поле role)
      if (user.role) {
        console.log(`✓ Пользователь ${userId} (${user.first_name}) уже обновлен (роль: ${user.role})`)
        continue
      }

      // Определение роли по имени
      let role = ROLES.CONTROLLER
      const name = data.name.toLowerCase()

      if (name.includes('админ')) {
        role = ROLES.ADMIN
      } else if (name.includes('ревизор')) {
        role = ROLES.REVISOR
      } else if (name.includes('начальник')) {
        role = ROLES.CHIEF
      } else if (data.section && data.section.length > 50) {
        role = ROLES.REVISOR
      } else if (data.section && data.section.length > 10) {
        role = ROLES.CHIEF
      }

      // Обновить пользователя
      const permissions = User.getDefaultPermissions(role)

      user.role = role
      user.sections = data.section || []
      user.permissions = permissions
      user.can_insert_readings = true
      user.is_active = true
      user.is_blocked = false
      user.updated_at = new Date()

      // Удалить старое поле privileges если есть
      if (user.privileges) {
        user.privileges = undefined
      }

      await user.save()

      console.log(`✅ Обновлен: ${user.first_name} → роль: ${role}, участков: ${user.sections.length}`)
      updated++

    } catch (err) {
      console.error(`❌ Ошибка для ${userId} (${data.name}):`, err.message)
      errors++
    }
  }

  console.log('\n📊 Статистика обновления:')
  console.log(`   ✅ Обновлено: ${updated}`)
  console.log(`   ⏩ Не найдено в базе: ${notFound}`)
  console.log(`   ❌ Ошибок: ${errors}`)

  // Показать пользователей, которые не в authChatId
  console.log('\n🔍 Проверка пользователей в базе...')
  const allUsers = await User.find()
  const authUserIds = Object.keys(authChatId).map(id => parseInt(id))

  const orphanUsers = allUsers.filter(u => !authUserIds.includes(u.user_id))
  if (orphanUsers.length > 0) {
    console.log('\n⚠️  Найдены пользователи в базе, которых НЕТ в auth.js:')
    orphanUsers.forEach(u => {
      console.log(`   - ${u.first_name} (ID: ${u.user_id}) - роль: ${u.role || 'НЕТ'}`)
    })
    console.log('\n   Эти пользователи могут быть:')
    console.log('   1. Созданы вручную')
    console.log('   2. Старые тестовые аккаунты')
    console.log('   3. Удалены из auth.js')
  } else {
    console.log('✅ Все пользователи из базы есть в auth.js')
  }
}

// Запуск скрипта
if (require.main === module) {
  connectToDatabase()
    .then(() => updateExistingUsers())
    .then(() => {
      console.log('\n✅ Обновление завершено успешно!')
      process.exit(0)
    })
    .catch(err => {
      console.error('❌ Ошибка обновления:', err)
      process.exit(1)
    })
}

module.exports = { updateExistingUsers }
