const { User, ROLES } = require('../models/User')
const { authChatId } = require('../modules/auth')
const { connectToDatabase } = require('../modules/mongoDb')

async function migrateUsers() {
  console.log('🔄 Начало миграции пользователей из auth.js...')

  let created = 0
  let skipped = 0
  let errors = 0

  for (const [userId, data] of Object.entries(authChatId)) {
    const userIdNum = parseInt(userId)

    try {
      // Проверка существования
      const existing = await User.findOne({ user_id: userIdNum })

      if (existing) {
        console.log(`⏩ Пользователь ${userId} (${data.name}) уже существует`)
        skipped++
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
      } else if (data.section.length > 50) {
        // Если много участков - возможно ревизор
        role = ROLES.REVISOR
      } else if (data.section.length > 10) {
        // Среднее количество - возможно начальник участка
        role = ROLES.CHIEF
      }

      const permissions = User.getDefaultPermissions(role)

      const user = new User({
        user_id: userIdNum,
        first_name: data.name,
        role,
        sections: data.section || [],
        permissions,
        can_insert_readings: true,
        is_active: true,
        created_at: new Date()
      })

      await user.save()
      console.log(`✅ Создан: ${data.name} (${role}) - участков: ${data.section?.length || 0}`)
      created++

    } catch (err) {
      console.error(`❌ Ошибка для ${userId} (${data.name}):`, err.message)
      errors++
    }
  }

  console.log('\n📊 Статистика миграции:')
  console.log(`   ✅ Создано: ${created}`)
  console.log(`   ⏩ Пропущено (уже существуют): ${skipped}`)
  console.log(`   ❌ Ошибок: ${errors}`)
  console.log(`   📝 Всего обработано: ${Object.keys(authChatId).length}`)
}

// Запуск скрипта
if (require.main === module) {
  connectToDatabase()
    .then(() => migrateUsers())
    .then(() => {
      console.log('\n✅ Миграция завершена успешно!')
      process.exit(0)
    })
    .catch(err => {
      console.error('❌ Ошибка миграции:', err)
      process.exit(1)
    })
}

module.exports = { migrateUsers }
