const { connection, checkConnection, userState } = require("../accessDb");
const { deskCodes, paymentCodes, streetCodes } = require("./dataObjects");
const { menu, cheap, payments } = require("./options");

async function searchByUser(text, ctx, User) {
  const chatId = ctx.from.id;
  userState[chatId] = { searchValue: parseInt(text) };
  const user = await User.findOne({ user_id: chatId });

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
      }\n🏠 адрес:${streetName} ${
        userData[0].HOUSE
      }\n💰 долг: ${userData[0].Долг.toFixed(
        0
      )} тг\n🧾 дата расчета: ${dataRep}`;

      const sentMessage = await ctx.replyWithHTML(userProfile, menu);
      user.data = {
        ...user.data,
        searchValue: userState[chatId].searchValue,
        consname: userData[0].CONSNAME,
        sentMessage: sentMessage.message_id,
        userProfile,
      };
      await user.save();
    } else {
      userState[chatId] = { state: "search" };
      const message = `Нет результатов для л/с ${userState[chatId].searchValue}`;
      ctx.reply(message);
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

async function searchPayment(User, ctx) {
  const chatId = ctx.from.id;
  const user = await User.findOne({ user_id: chatId });

  let table = `👤 ( ${user.data.searchValue} ) ${user.data.consname}\nСписок последних оплат:
    \n📅 Дата 💳 Касса 📑 Вид.опл 💰 Сумма\n`;

  const sqlQuery = `SELECT TOP 12 SUMMA, PDESKCODE, PDATE, GROUPCODE
    FROM HEAP WHERE CONSCODE = ${user.data.searchValue}
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

      const sentMessage = await ctx.telegram.editMessageText(
        chatId,
        user.data.sentMessage,
        null,
        table,
        cheap
      );
      user.data = {
        ...user.data,
        sentMessage: sentMessage.message_id,
      };
      await user.save();
    } else {
      const message = `Нет результатов для л/с ${user.data.searchValue}`;
      ctx.reply(message);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchCheap(User, ctx) {
  const chatId = ctx.from.id;
  const user = await User.findOne({ user_id: chatId });
  try {
    const searchQuery = `
        SELECT DISTINCT WCOUNT.WCODE, WCOUNT.FACTNUMB, WCOUNT.DATESET
        FROM WCOUNT
        WHERE WCOUNT.CONSCODE = ${user.data.searchValue}
      `;

    const waterMeters = await connection.query(searchQuery);

    let formattedResult = `👤 ( ${user.data.searchValue} ) ${user.data.consname}\n`;
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

    const sentMessage = await ctx.telegram.editMessageText(
      chatId,
      user.data.sentMessage,
      null,
      formattedResult,
      payments
    );
    user.data = {
      ...user.data,
      sentMessage: sentMessage.message_id,
    };
    await user.save();

    // ctx.replyWithHTML(formattedResult, menu);
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function back(User, ctx) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });
    const sentMessage = await ctx.telegram.editMessageText(
      chatId,
      user.data.sentMessage,
      null,
      user.data.userProfile,
      menu
    );
    user.data = {
      ...user.data,
      sentMessage: sentMessage.message_id,
    };
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
  back,
};
