const {
  connection,
  checkConnection,
  deskCodes,
  paymentCodes,
  streetCodes,
} = require("./accessDb");
const { menu, cheap, payments } = require("./button");
const button = require("./button");

async function searchByUser(searchValue, ctx, User) {
  try {
    if (isNaN(searchValue)) {
      return ctx.reply("Введите число!");
    }
    await checkConnection();

    const query = `
  SELECT 
  CONSUM.CONSNAME AS consname, 
  CONSUM.STRTCODE AS streetCode, 
  CONSUM.HOUSE AS house, 
  зTOTPAY_ALL_Тек.Долг AS debt, 
  зTOTPAY_ALL_Тек.ДатаРсч AS dateRep
  FROM CONSUM INNER JOIN зTOTPAY_ALL_Тек 
  ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE
  WHERE CONSUM.CONSCODE = ${searchValue};`;

    const data = await connection.query(query);

    if (data.length > 0) {
      const { consname, streetCode, house, debt, dateRep } = data[0];
      const streetName = streetCodes[streetCode];
      const userProfile = `👤 ( ${searchValue} ) ${consname}
🏠 адрес: ${streetName} ${house}
💰 долг: ${debt.toFixed(2)} тг
🧾 дата расчета: ${dateRep.slice(0, 10)}`;

      const user = await User.findOne({ user_id: ctx.from.id });

      if (user && user.data && user.data.sentMessage) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, user.data.sentMessage);
        } catch (deleteError) {
          console.error(
            "Ошибка при удалении предыдущего сообщения:",
            deleteError
          );
          if (deleteError.response && deleteError.response.error_code === 400) {
            console.log(
              `Сообщение с ID ${user.data.sentMessage} не найдено или уже удалено.`
            );
          }
        }
      }

      const sentMessage = await ctx.replyWithHTML(userProfile, menu);

      user.data = {
        ...user.data,
        searchValue,
        consname,
        sentMessage: sentMessage.message_id,
        userProfile,
      };

      await user.save();
    } else {
      await ctx.reply(`Нет результатов для л/с ${searchValue}`);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    await ctx.reply(
      "Произошла ошибка при выполнении запроса. Попробуйте позже."
    );
  }
}

async function searchByWm(text, ctx) {
  try {
    if (isNaN(text)) {
      return ctx.reply("Введите число|");
    }

    await checkConnection();

    const query = `SELECT * FROM з_АбонентыВМ WHERE [wm] LIKE '%${text}%'`;

    const data = await connection.query(query);
    if (data.length > 0) {
      for (const { userId, user, location, wm } of data) {
        const userProfile = `Л/с: ${userId}
Абонент: ${user}
Участок: ${location}
Водомер: ${wm}`;
        const btn = button.byWm(userId, `searchUser_${userId}`);
        await ctx.replyWithHTML(userProfile, btn);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } else {
      ctx.reply(`Нет результатов для в/м ${text}`);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchByName(text, ctx) {
  try {
    await checkConnection();

    const query = `SELECT * FROM з_АбонентыВМ WHERE [name] LIKE '%${text}%'`;

    const data = await connection.query(query);

    if (data.length > 0) {
      data.forEach(async ({ userId, user, location, wm }) => {
        const userProfile = `
Л/с: ${userId}
Абонент: ${user}
Участок: ${location}
Водомер: ${wm}`;

        const btn = button.byWm(userId, `searchUser_${userId}`);

        await ctx.replyWithHTML(userProfile, btn);
      });
    } else {
      ctx.reply(`Нет результатов для фио ${text}`);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchPayment(User, ctx) {
  const chatId = ctx.from.id;
  const user = await User.findOne({ user_id: chatId });

  let message = `👤 ( ${user.data.searchValue} ) ${user.data.consname}\nСписок последних оплат:
    \n📅 Дата 💳 Касса 📑 Вид.опл 💰 Сумма\n`;

  const sqlQuery = `
  SELECT TOP 12 SUMMA AS summa, 
  PDESKCODE AS deskCode, 
  PDATE AS pdate, 
  GROUPCODE AS paymentCode
  FROM HEAP 
  WHERE CONSCODE = ${user.data.searchValue}
  ORDER BY PDATE DESC`;

  try {
    await checkConnection();

    const data = await connection.query(sqlQuery);

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        const { summa, deskCode, pdate, paymentCode } = data[i];
        const deskName = deskCodes[deskCode] || "";
        const paymentName = paymentCodes[paymentCode] || "";
        const dateOnly = pdate.substring(0, 10);
        const sum = summa.toFixed(2);
        message += `${dateOnly}, ${deskName}, ${paymentName}, ${sum} тг\n`;
      }

      const sentMessage = await ctx.telegram.editMessageText(
        chatId,
        user.data.sentMessage,
        null,
        message,
        cheap
      );
      user.data = {
        ...user.data,
        sentMessage: sentMessage.message_id,
      };
      await user.save();
    } else {
      ctx.reply(`Нет результатов для л/с ${user.data.searchValue}`);
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
