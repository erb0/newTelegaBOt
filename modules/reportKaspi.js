const XLSX = require('xlsx')
const nodemailer = require('nodemailer')

async function executeQuery(chatId, connection, bot) {
  try {
    await bot.sendMessage(chatId, '🕒 Выполняется запрос...')
    const data = await connection.query(`SELECT * FROM 1_sqlQueryForKaspi`)
    bot.sendMessage(chatId, '...')
    return data
  } catch (err) {
    throw new Error(`Ошибка при выполнении запроса: ${err}`)
  }
}

function createExcelFile(data, chatId, bot) {
  const wsData = data.map((row) => Object.values(row))
  const ws = XLSX.utils.aoa_to_sheet([Object.keys(data[0])].concat(wsData))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Лист1')
  const filePath = 'kaspi.xlsx'
  XLSX.writeFile(wb, filePath, { compression: true })
  bot.sendMessage(chatId, '...')
  return filePath
}

async function sendEmail(filePath, chatId, bot) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'mail.ru',
      auth: {
        user: 'too2006@mail.ru',
        pass: 'sY5Myr1HqsDDV7m14hba',
      },
    })

    const mailOptions = {
      from: 'too2006@mail.ru',
      // to: "ib.invoices@kaspi.kz",
      to: 'erb0_01@mail.ru',
      subject: 'kaspi.xlsx',
      text: "ТОО 'Сайрам Тазалык'",
      attachments: [
        {
          filename: 'kaspi.xlsx',
          path: filePath,
        },
      ],
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Письмо с файлом успешно отправлено:', info.response)
    bot.sendMessage(
      chatId,
      `✅ Письмо с файлом успешно отправлено!\n${info.response}`
    )
  } catch (error) {
    throw new Error(`Ошибка при отправке почты: ${error}`)
  }
}

async function main(chatId, conection, bot) {
  try {
    const data = await executeQuery(chatId, conection, bot)
    const filePath = createExcelFile(data, chatId, bot)
    console.log('Данные для отчета Kaspi экспортированы в Excel успешно!')
    await sendEmail(filePath, chatId, bot)
  } catch (err) {
    console.error(err.message)
  }
}

module.exports = {
  executeQuery,
  createExcelFile,
  sendEmail,
  main,
}
