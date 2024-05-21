const { Markup } = require("telegraf");
const { restart, yes } = require("./button");
const { connection, checkConnection, streetCodes } = require("./accessDb");
const { authChatId } = require("./auth");
const { log, formatDate } = require("./plugin");

async function userInfoForInsert(userId, text, ctx, User) {
  try {
    if (!authChatId[userId]) {
      await User.updateOne({ user_id: userId }, { state: "null" });
      return ctx.replyWithHTML("Вы не авторизовались");
    }
    if (isNaN(text)) {
      return ctx.reply("Введите цифры!");
    }
    const user = await User.findOne({ user_id: userId });

    const locationCodeArray = authChatId[userId].section
      .map((value) => `'${value}'`)
      .join(",");

    await checkConnection();

    const query = `
SELECT 
CONSUM.CONSNAME AS consname,
CONSUM.FSBDVCODE,
CONSUM.STRTCODE AS streetCode,
CONSUM.HOUSE AS house, 
CONSUM.CONSCODE AS conscode, 
WCOUNT.FACTNUMB AS wmNumber, 
WCOUNT.WCODE AS wcode
FROM CONSUM
INNER JOIN WCOUNT 
ON CONSUM.CONSCODE = WCOUNT.CONSCODE
WHERE CONSUM.FSBDVCODE 
IN (${locationCodeArray}) 
AND WCOUNT.CONSCODE = ${text}`;

    const data = await connection.query(query);

    if (data.length > 0) {
      const buttons = [];
      const { consname, streetCode, house, conscode } = data[0];
      const streetName = streetCodes[streetCode];

      let profile = `
👤 <b>[ ${conscode} ]</b>  <b><i>${consname}</i></b>
   <b><i>${streetName} ${house}</i></b>\n
Выберите счетчик воды:`;
      for (const row of data) {
        const { wcode, wmNumber } = row;
        const buttonText =
          wmNumber !== null ? `${wmNumber.toString()}` : "не указано";

        buttons.push([Markup.button.callback(buttonText, `wcode_${wcode}`)]);
      }
      await buttons.push([
        Markup.button.callback("Ввести другой л/c", "restart"),
      ]);
      const btn = Markup.inlineKeyboard(buttons);
      user.data = {
        ...user.data,
        consname,
        conscode,
        streetName,
        house,
      };
      await user.save();
      await User.updateOne({ user_id: userId }, { state: "insertWaterNumber" });
      await ctx.replyWithHTML(profile, btn);
    } else {
      ctx.reply("Нет данных для введенного номера.");
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    ctx.reply("Произошла ошибка при выполнении команды.");
  }
}

async function wcodeInfoForInsert(ctx, User) {
  try {
    const chatId = ctx.chat.id;
    const callbackData = ctx.match.input;
    const wcode = callbackData.replace("wcode_", "");
    const user = await User.findOne({ user_id: chatId });

    if (user.state === "insertWaterNumber") {
      await checkConnection();

      let data = await connection.query(
        `SELECT TOP 1 WCODE, Format([LASTDATE], 'mm.yyyy') AS FormattedDate, CURRCOUNT
         FROM WCHEAP
         WHERE WCODE = ${wcode}
         ORDER BY LASTDATE DESC`
      );

      const currentDate = new Date();
      const nowDate = formatDate(currentDate);

      if (!data[0]) {
        data = await connection.query(
          `SELECT WCODE, Format([DATESET], 'mm.yyyy') AS FormattedDate, STARTCOUNT AS CURRCOUNT
           FROM WCOUNT
           WHERE WCODE = ${wcode}`
        );
      }

      if (data[0]) {
        const { FormattedDate, CURRCOUNT, WCODE } = data[0];

        if (nowDate === FormattedDate) {
          await ctx.reply(
            "Данные за текущий месяц уже внесены!\nВыберите другой счетчик.\nИли воспользуйтесь кнопкой",
            restart
          );
          await ctx.deleteMessage();
        } else {
          await ctx.answerCbQuery();
          await ctx.replyWithHTML(
            `<b>Введите текущее показание</b>\n   последнее - <b>${CURRCOUNT}</b>`
          );

          user.data = {
            ...user.data,
            WCODE,
            CURRCOUNT,
            FormattedDate,
          };

          await user.save();
          await User.updateOne({ user_id: chatId }, { state: "insertValue" });
        }
      } else {
        await ctx.reply("Не удалось найти данные для данного кода.");
      }
    } else {
      await ctx.reply("Некорректное состояние пользователя.");
    }
  } catch (e) {
    console.error("Ошибка при обработке запроса:", e);
    await ctx.reply(
      "Произошла ошибка при выполнении команды. Попробуйте снова позже."
    );
  }
}

async function insertValue(chatId, text, ctx, User) {
  try {
    const user = await User.findOne({ user_id: chatId });

    if (!user) {
      return ctx.reply("Пользователь не найден.");
    }

    if (isNaN(text) || parseInt(text) < 0) {
      return ctx.reply("Введите положительное число!");
    }

    const LASTCOUNT = parseInt(text);

    const { CURRCOUNT, WCODE } = user.data;
    const diff = LASTCOUNT - CURRCOUNT;
    user.data = {
      ...user.data,
      LASTCOUNT,
    };
    await user.save();

    if (diff > 50) {
      return ctx.replyWithHTML(
        `Разница между введенным значением\n<b>[ ${diff} ]</b> это больше чем 50.\nНажмите "Да", или введите другое значение`,
        yes
      );
    } else if (diff <= 50 && LASTCOUNT > CURRCOUNT) {
      try {
        const currentDate = new Date().toISOString().slice(0, 10); // Получение текущей даты в формате YYYY-MM-DD

        const sqlQuery = `
INSERT 
INTO WCHEAP
VALUES ('${WCODE}', '${currentDate}', ${LASTCOUNT}, ${CURRCOUNT}, null)`;

        await connection.execute(sqlQuery);

        await ctx.reply("Данные успешно вставлены.\nВведите другой л/с!");
        await User.updateOne({ user_id: chatId }, { state: "insertConscode" });
        await log(user, authChatId, chatId, ctx);
      } catch (dbError) {
        console.log("Ошибка базы данных:", dbError);
        return ctx.reply("Ошибка при вставке данных в базу данных.");
      }
    } else {
      return ctx.replyWithHTML(
        `Внесенные данные меньше последнего показания <b>[${CURRCOUNT}]</b>\nВнесите другое значение или возпользуйтесь кнопкой для выбора другого л/c!`,
        restart
      );
    }
  } catch (error) {
    console.log("Общая ошибка:", error);
    return ctx.reply("Произошла ошибка. Попробуйте еще раз позже.");
  }
}

async function insertIfYes(ctx, User) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });

    if (!user) {
      return ctx.reply("Пользователь не найден.");
    }

    const { CURRCOUNT, WCODE, LASTCOUNT } = user.data;
    const DATE = new Date().toISOString().slice(0, 10);

    await checkConnection();

    const query = `
INSERT INTO WCHEAP 
VALUES ('${WCODE}', '${DATE}', ${LASTCOUNT}, ${CURRCOUNT}, null)`;

    await connection.execute(query);

    await ctx.reply("Данные успешно вставлены.\nВведите л/с!");

    await User.updateOne({ user_id: chatId }, { state: "insertConscode" });
    await log(user, authChatId, chatId, ctx);
  } catch (error) {
    console.log("Ошибка insertIfYes", error);
    await ctx.reply("Ошибка при вставке данных. Попробуйте еще раз.");
  }
}

module.exports = {
  userInfoForInsert,
  wcodeInfoForInsert,
  insertValue,
  insertIfYes,
};
