const { Section } = require('../models/Section')
const { connection } = require('../modules/accessDb')
const { connectToDatabase } = require('../modules/mongoDb')

async function syncSections() {
  console.log('🔄 Синхронизация участков из Access DB...')

  const query = `
    SELECT GRCODE, FSBDVCODE, SBDVCODE, SECTCODE, SECTNAME, CHIEFNAME
    FROM SECTION
    ORDER BY FSBDVCODE`

  try {
    const sections = await connection.query(query)
    let created = 0
    let updated = 0

    for (const row of sections) {
      const existing = await Section.findOne({ FSBDVCODE: row.FSBDVCODE })

      if (existing) {
        // Обновить существующий
        existing.GRCODE = row.GRCODE
        existing.SBDVCODE = row.SBDVCODE
        existing.SECTCODE = row.SECTCODE
        existing.SECTNAME = row.SECTNAME
        existing.CHIEFNAME = row.CHIEFNAME
        existing.is_active = true
        existing.updated_at = new Date()
        await existing.save()
        updated++
      } else {
        // Создать новый
        await Section.create({
          GRCODE: row.GRCODE,
          FSBDVCODE: row.FSBDVCODE,
          SBDVCODE: row.SBDVCODE,
          SECTCODE: row.SECTCODE,
          SECTNAME: row.SECTNAME,
          CHIEFNAME: row.CHIEFNAME,
          is_active: true,
          updated_at: new Date()
        })
        created++
      }
    }

    console.log(`✅ Синхронизация завершена:`)
    console.log(`   Создано: ${created}`)
    console.log(`   Обновлено: ${updated}`)
    console.log(`   Всего: ${sections.length}`)
  } catch (err) {
    console.error('❌ Ошибка синхронизации:', err)
    throw err
  }
}

// Запуск скрипта
if (require.main === module) {
  connectToDatabase()
    .then(() => syncSections())
    .then(() => {
      console.log('✅ Скрипт завершен успешно')
      process.exit(0)
    })
    .catch(err => {
      console.error('❌ Ошибка выполнения скрипта:', err)
      process.exit(1)
    })
}

module.exports = { syncSections }
