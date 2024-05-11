const { connection, checkConnection, userState } = require("./conectionDb");
const { deskCodes, paymentCodes, streetCodes } = require("./dataObjects");
const { menu } = require("./options");

async function searchByUser(chatId, text, bot) {
  userState[chatId] = { searchValue: parseInt(text) };

  const sqlSearch = `
  SELECT CONSUM.CONSNAME, CONSUM.STRTCODE, CONSUM.HOUSE, зTOTPAY_ALL_Тек.Долг, зTOTPAY_ALL_Тек.ДатаРсч
  FROM CONSUM INNER JOIN зTOTPAY_ALL_Тек ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE
  WHERE CONSUM.CONSCODE = ${userState[chatId].searchValue};`;

  try {
    await checkConnection();
    const userData = await connection.query(sqlSearch);
    if (userData && userData.length > 0) {
      const streetCode = userData[0].STRTCODE;
      const streetName = streetCodes[streetCode];
      const dataRep = userData[0].ДатаРсч.slice(0, 10);
      const userProfile = `👤 ( ${userState[chatId].searchValue} ) ${
        userData[0].CONSNAME
      }
🏠 адрес:${streetName} ${userData[0].HOUSE}
💰 долг: ${userData[0].Долг.toFixed(0)} тг
🧾 дата расчета: ${dataRep}`;
      bot.sendMessage(chatId, userProfile, menu);
    } else {
      userState[chatId] = { state: "search" };
      const message = `Нет результатов для л/с ${text}`;
      bot
        .sendMessage(chatId, message)
        .catch((error) =>
          console.error("Ошибка при отправке сообщения:", error)
        );
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchByWm(chatId, text, bot) {
  const searchValue = parseInt(text);

  const byWmQuery = `SELECT * FROM з_АбонентыВМ WHERE [wm] LIKE '%${searchValue}%'`;

  try {
    await checkConnection();
    const wmData = await connection.query(byWmQuery);
    if (wmData && wmData.length > 0) {
      for (let i = 0; i < wmData.length; i++) {
        const userProfileWm = `Л/с: ${wmData[i].userId}\nАбонент: ${wmData[i].user}\nУчасток: ${wmData[i].location}\nВодомер: ${wmData[i].wm}`;

        const inlineKeyboard = [
          [
            {
              text: wmData[i].userId.toString(),
              callback_data: `searchUser_${wmData[i].userId}`,
            },
          ],
        ];

        const options = {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        };
        await bot.sendMessage(chatId, userProfileWm, options);
      }
    } else {
      const message = `Нет результатов для в/м ${searchValue}`;
      bot.sendMessage(chatId, message);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchByName(chatId, text, bot) {
  const searchValue = text;
  const byWmQuery = `SELECT * FROM з_АбонентыВМ WHERE [name] LIKE '%${searchValue}%'`;

  try {
    await checkConnection();
    const wmData = await connection.query(byWmQuery);
    if (wmData && wmData.length > 0) {
      for (let i = 0; i < wmData.length; i++) {
        const userProfileWm = `Л/с: ${wmData[i].userId}\nАбонент: ${wmData[i].user}\nУчасток: ${wmData[i].location}\nВодомер: ${wmData[i].wm}`;
        const inlineKeyboard = [
          [
            {
              text: wmData[i].userId.toString(),
              callback_data: `searchUser_${wmData[i].userId}`,
            },
          ],
        ];
        const options = {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        };
        await bot.sendMessage(chatId, userProfileWm, options);
      }
    } else {
      const message = `Нет результатов для фио ${searchValue}`;
      bot.sendMessage(chatId, message);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchPayment(chatId, userState, bot) {
  // let table = `Л/счет - ${userState[chatId].searchValue}\n\nСписок последних оплат:
  //   \n📅 Дата 💳 Касса 📑 Вид.опл 💰 Сумма\n`;
  let table = `Список последних оплат:
    \n📅 Дата 💳 Касса 📑 Вид.опл 💰 Сумма\n`;

  const sqlQuery = `SELECT TOP 12 SUMMA, PDESKCODE, PDATE, GROUPCODE
    FROM HEAP WHERE CONSCODE = ${userState[chatId].searchValue}
    ORDER BY PDATE DESC`;

  try {
    await checkConnection();

    const data = await connection.query(sqlQuery);

    if (data && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        const deskCode = data[i].PDESKCODE;
        const deskName = deskCodes[deskCode] || "";
        const paymentCode = data[i].GROUPCODE;
        const paymentName = paymentCodes[paymentCode] || "";
        const dateOnly = data[i].PDATE.substring(0, 10);
        table += `${dateOnly}, ${deskName}, ${paymentName}, ${data[
          i
        ].SUMMA.toFixed(2)} тг\n`;
      }

      bot.sendMessage(chatId, table, menu);
    } else {
      const message = `Нет результатов для л/с ${userState[chatId].searchValue}`;
      bot
        .sendMessage(chatId, message)
        .catch((error) =>
          console.error("Ошибка при отправке сообщения:", error)
        );
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchCheap(chatId, userState, bot) {
  try {
    const searchQuery = `
        SELECT DISTINCT WCOUNT.WCODE, WCOUNT.FACTNUMB, WCOUNT.DATESET
        FROM WCOUNT
        WHERE WCOUNT.CONSCODE = ${userState[chatId].searchValue}
      `;

    const waterMeters = await connection.query(searchQuery);

    let formattedResult = "";
    for (const waterMeter of waterMeters) {
      const { WCODE, FACTNUMB, DATESET } = waterMeter;
      const sliceDateset = DATESET.slice(0, 10);
      formattedResult += `Номер водомера: ${FACTNUMB}\nДата установки: ${sliceDateset}
        \n📅 Дата | 📋Показания\n`;

      const waterMeterQuery = `
          SELECT TOP 12 WCHEAP.CURRCOUNT, WCHEAP.LASTDATE
          FROM WCHEAP
          WHERE WCHEAP.WCODE = ${WCODE}
          ORDER BY WCHEAP.LASTDATE DESC
        `;

      const result = await connection.query(waterMeterQuery);

      for (const row of result) {
        const { CURRCOUNT, LASTDATE } = row;
        const sliceDate = LASTDATE.slice(0, 10);
        formattedResult += `${sliceDate} | ${CURRCOUNT}\n`;
      }

      formattedResult += "------------------------\n";
    }

    bot.sendMessage(chatId, formattedResult, menu); // Отправляем сообщение
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

module.exports = {
  searchByName,
  searchPayment,
  searchCheap,
  searchByUser,
  searchByWm,
};
