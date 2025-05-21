const {
  connection,
  checkConnection,
  deskCodes,
  paymentCodes,
  streetCodes,
} = require("./accessDb");
const { menu, cheap, payments, byWm } = require("./button");
const { logInfo } = require("./plugin");
const { authChatId } = require("./auth");
const { logInfoMongo } = require("./mongoDb");

function validateNumberInput(input, ctx) {
  if (isNaN(input)) {
    ctx.reply("Введите число!");
    return false;
  }
  return true;
}

function buildUserProfile(data, searchValue) {
  const { consname, streetCode, house, debt, dateRep, w, ww } = data;
  const streetName = streetCodes[streetCode] || "Неизвестная улица";
  const wCheckBox = w > 0 ? "✅" : "❌";
  const wwCheckBox = ww > 0 ? "✅" : "❌";
  return `👤 ( ${searchValue} ) ${consname}
🏠 адрес: ${streetName} ${house}
💰 долг: ${debt.toFixed(2)} тг
🧾 дата расчета: ${dateRep.slice(0, 10)}
🚰 тариф
${wCheckBox} вода: ${w.toFixed(2)} тг
${wwCheckBox} канализация: ${ww.toFixed(2)} тг`;
}

async function searchByUser(locationCodeArray, searchValue, ctx, User) {
  try {
    if (!validateNumberInput(searchValue, ctx)) return;

    const chatId = ctx.from.id;
    const name = authChatId[chatId]?.name || "Неизвестный";
    logInfo(chatId, name, searchValue, "Лсчет", ctx);
    logInfoMongo(chatId, name, searchValue, "Лсчет", ctx);
    await checkConnection();

    const query = `SELECT CONSUM.CONSNAME AS consname, CONSUM.STRTCODE AS streetCode, CONSUM.HOUSE AS house,
                   зTOTPAY_ALL_Тек.Долг AS debt, зTOTPAY_ALL_Тек.ДатаРсч AS dateRep,
                   зTOTPAY_ALL_Тек.ТрфПит AS w, зTOTPAY_ALL_Тек.ТрфКан AS ww
                   FROM CONSUM INNER JOIN зTOTPAY_ALL_Тек 
                   ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE
                   WHERE CONSUM.FSBDVCODE IN (${locationCodeArray}) 
                   AND CONSUM.CONSCODE = ${searchValue};`;

    const data = await connection.query(query);

    if (data.length > 0) {
      const userProfile = buildUserProfile(data[0], searchValue);
      const user = await User.findOne({ user_id: chatId });

      if (user?.data?.sentMessage) {
        try {
          await ctx.telegram.deleteMessage(chatId, user.data.sentMessage);
        } catch (deleteError) {
          if (deleteError.response?.error_code !== 400) {
            console.error(
              "Ошибка при удалении предыдущего сообщения:",
              deleteError
            );
          }
        }
      }

      const sentMessage = await ctx.replyWithHTML(userProfile, menu);
      user.data = {
        ...user.data,
        searchValue,
        consname: data[0].consname,
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

async function searchWmOrName(text, ctx, searchField) {
  try {
    await checkConnection();
    const chatId = ctx.from.id;
    const name = authChatId[chatId]?.name || "Неизвестный";
    logInfo(chatId, name, text, searchField === "wm" ? "в/м" : "фио", ctx);

    const query = `SELECT * FROM з_АбонентыВМ WHERE [${searchField}] LIKE '%${text}%'`;
    const data = await connection.query(query);

    if (data.length > 0) {
      for (const { userId, user, location, wm } of data) {
        const userProfile = `Л/с: ${userId}
Абонент: ${user}
Участок: ${location}
Водомер: ${wm}`;
        await ctx.replyWithHTML(userProfile, byWm(userId));
        await new Promise((res) => setTimeout(res, 500));
      }
    } else {
      ctx.reply(
        `Нет результатов для ${searchField === "wm" ? "в/м" : "фио"} ${text}`
      );
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

const searchByWm = (text, ctx) =>
  validateNumberInput(text, ctx) && searchWmOrName(text, ctx, "wm");
const searchByName = (text, ctx) => searchWmOrName(text, ctx, "name");

async function searchPayment(User, ctx) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });

    let message = `👤 ( ${user.data.searchValue} ) ${user.data.consname}
Список последних оплат:
📅 Дата 💳 Касса 📑 Вид.опл 💰 Сумма\n`;
    const sqlQuery = `SELECT TOP 12 SUMMA AS summa, PDESKCODE AS deskCode, PDATE AS pdate, GROUPCODE AS paymentCode FROM HEAP WHERE CONSCODE = ${user.data.searchValue} ORDER BY PDATE DESC`;

    await checkConnection();
    const data = await connection.query(sqlQuery);

    if (data.length > 0) {
      message += data
        .map(({ summa, deskCode, pdate, paymentCode }) => {
          return `${pdate.substring(0, 10)}, ${deskCodes[deskCode] || ""}, ${
            paymentCodes[paymentCode] || ""
          }, ${summa.toFixed(2)} тг`;
        })
        .join("\n");

      const sentMessage = await ctx.telegram.editMessageText(
        chatId,
        user.data.sentMessage,
        null,
        message,
        cheap
      );
      user.data.sentMessage = sentMessage.message_id;
      await user.save();
    } else {
      ctx.reply(`Нет результатов для л/с ${user.data.searchValue}`);
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchCheap(User, ctx) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });
    const searchQuery = `SELECT DISTINCT WCODE, FACTNUMB, DATESET FROM WCOUNT WHERE CONSCODE = ${user.data.searchValue}`;
    const waterMeters = await connection.query(searchQuery);

    let formattedResult = `👤 ( ${user.data.searchValue} ) ${user.data.consname}\n`;

    for (const { WCODE, FACTNUMB, DATESET } of waterMeters) {
      formattedResult += `Номер водомера: ${FACTNUMB}\nДата установки: ${DATESET.slice(
        0,
        10
      )}\n📅 Дата | 📋Показания\n`;

      const result = await connection.query(
        `SELECT TOP 12 CURRCOUNT, LASTDATE FROM WCHEAP WHERE WCODE = ${WCODE} ORDER BY LASTDATE DESC`
      );

      result.forEach(({ CURRCOUNT, LASTDATE }) => {
        formattedResult += `${LASTDATE.slice(0, 10)} | ${CURRCOUNT}\n`;
      });

      formattedResult += "------------------------\n";
    }

    const sentMessage = await ctx.telegram.editMessageText(
      chatId,
      user.data.sentMessage,
      null,
      formattedResult,
      payments
    );
    user.data.sentMessage = sentMessage.message_id;
    await user.save();
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
    user.data.sentMessage = sentMessage.message_id;
    await user.save();
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
