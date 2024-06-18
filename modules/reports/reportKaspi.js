const XLSX = require("xlsx");
const nodemailer = require("nodemailer");

async function executeQuery(chatId, connection, ctx) {
  try {
    await ctx.telegram.sendMessage(chatId, "🕒 Выполняется запрос...");
    const data = await connection.query(`SELECT * FROM 1_sqlQueryForKaspi`);
    ctx.telegram.sendMessage(chatId, "Запрос выполнен!");
    return data;
  } catch (err) {
    throw new Error(`Ошибка при выполнении запроса: ${err}`);
  }
}

function createExcelFile(data, chatId, ctx) {
  const wsData = data.map((row) => Object.values(row));
  const ws = XLSX.utils.aoa_to_sheet([Object.keys(data[0])].concat(wsData));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Лист1");
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "_");
  const filePath = `./modules/KASPI/kaspi_${date}.xlsx`;
  XLSX.writeFile(wb, filePath, { compression: true });
  ctx.telegram.sendMessage(chatId, "Файл эксель создан!");

  return filePath;
}

async function sendEmail(filePath, chatId, ctx) {
  try {
    const transporter = nodemailer.createTransport({
      service: "mail.ru",
      auth: {
        user: "too2006@mail.ru",
        pass: "sY5Myr1HqsDDV7m14hba",
      },
    });
    // const transporter = nodemailer.createTransport({
    //   service: "mail.ru",
    //   auth: {
    //     user: "too2006@mail.ru",
    //     pass: "sY5Myr1HqsDDV7m14hba",
    //   },
    //   tls: {
    //     rejectUnauthorized: false,
    //   },
    //   socketTimeout: 300000, // Таймаут на 5 минут
    //   connectionTimeout: 300000, // Таймаут на 5 минут
    //   greetingTimeout: 300000, // Таймаут на 5 минут
    // });

    const mailOptions = {
      from: "too2006@mail.ru",
      to: "ib.invoices@kaspi.kz",
      // to: "erb0_01@mail.ru",
      subject: "kaspi.xlsx",
      text: "ТОО 'Сайрам Тазалык'",
      attachments: [
        {
          filename: "kaspi.xlsx",
          path: filePath,
        },
      ],
    };
    // const { default: pTimeout } = await import("p-timeout");
    // console.log("Отправка почты с таймаутом 300000 мс");
    // const info = await pTimeout(transporter.sendMail(mailOptions), 300000);

    const info = await transporter.sendMail(mailOptions);
    console.log("Письмо с файлом успешно отправлено:", info.response);
    ctx.telegram.sendMessage(
      chatId,
      `✅ Письмо с файлом успешно отправлено!\n${info.response}`
    );
  } catch (error) {
    throw new Error(`Ошибка при отправке почты: ${error}`);
  }
}

async function main(chatId, conection, ctx) {
  try {
    const data = await executeQuery(chatId, conection, ctx);
    const filePath = createExcelFile(data, chatId, ctx);
    console.log("Данные для отчета Kaspi экспортированы в Excel успешно!");
    await sendEmail(filePath, chatId, ctx);
  } catch (err) {
    console.error(err.message);
  }
}

module.exports = {
  executeQuery,
  createExcelFile,
  sendEmail,
  main,
};
