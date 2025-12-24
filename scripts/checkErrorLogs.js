const mongoose = require('mongoose')
const { ErrorLog, connectToDatabase } = require('../modules/mongoDb')

async function checkErrorLogs() {
  try {
    await connectToDatabase()
    console.log('Подключение к MongoDB успешно\n')

    // Получаем все логи ошибок, сортируем по дате (новые первыми)
    const errorLogs = await ErrorLog.find({}).sort({ timestamp: -1 }).limit(50)

    if (errorLogs.length === 0) {
      console.log('✅ Логи ошибок отсутствуют')
      return
    }

    console.log(`\n📋 Найдено ошибок: ${errorLogs.length}\n`)
    console.log('=' .repeat(80))

    // Группируем ошибки по контексту для анализа
    const errorsByContext = {}

    errorLogs.forEach((log, index) => {
      const context = log.context || 'Unknown'
      if (!errorsByContext[context]) {
        errorsByContext[context] = []
      }
      errorsByContext[context].push(log)

      console.log(`\n[${index + 1}] Ошибка в ${log.context}`)
      console.log(`Дата: ${new Date(log.timestamp).toLocaleString('ru-RU')}`)
      console.log(`Сообщение: ${log.errorMessage}`)
      if (log.userId) console.log(`User ID: ${log.userId}`)
      if (log.userName) console.log(`User Name: ${log.userName}`)
      if (log.additionalData) {
        console.log(`Доп. данные: ${JSON.stringify(log.additionalData, null, 2)}`)
      }
      if (log.errorStack) {
        console.log(`\nСтек:\n${log.errorStack.substring(0, 300)}...`)
      }
      console.log('-'.repeat(80))
    })

    // Статистика по контекстам
    console.log('\n\n📊 СТАТИСТИКА ПО ОШИБКАМ:')
    console.log('=' .repeat(80))
    Object.entries(errorsByContext)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([context, errors]) => {
        console.log(`${context}: ${errors.length} ошибок`)
        // Показываем самые частые сообщения
        const messages = {}
        errors.forEach(err => {
          const msg = err.errorMessage
          messages[msg] = (messages[msg] || 0) + 1
        })
        Object.entries(messages)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .forEach(([msg, count]) => {
            console.log(`  - ${msg} (${count}x)`)
          })
      })

  } catch (error) {
    console.error('❌ Ошибка при проверке логов:', error)
  } finally {
    await mongoose.connection.close()
    console.log('\n\nПодключение к MongoDB закрыто')
  }
}

checkErrorLogs()
