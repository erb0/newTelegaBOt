const { Markup } = require("telegraf");
const { restart, yes } = require("./buttons");
const { connection, checkConnection } = require("./conection");
const { formatDate, log } = require("./plugin");
const { authChatId } = require("./auth");
const { streetCodes } = require("./streetData");

async function userInfoForInsert(userId, text, ctx, User) {
  try {
    const user = await User.findOne({ user_id: userId });
    if (authChatId[userId]) {
      const arrayString = authChatId[userId].section
        .map((value) => `'${value}'`)
        .join(",");
      await checkConnection();
      const data = await connection.query(
        `SELECT CONSUM.CONSNAME,CONSUM.FSBDVCODE,CONSUM.STRTCODE,CONSUM.HOUSE, CONSUM.CONSCODE, WCOUNT.FACTNUMB, WCOUNT.WCODE
        FROM CONSUM
        INNER JOIN WCOUNT ON CONSUM.CONSCODE = WCOUNT.CONSCODE
        WHERE CONSUM.FSBDVCODE IN (${arrayString}) AND WCOUNT.CONSCODE = ${text}`
      );

      if (data.length === 0) {
        ctx.reply("Нет данных для введенного номера.");
      } else {
        let profile = "Выберите счетчик воды:\n\n";
        const buttons = [];
        const streetCode = data[0].STRTCODE;
        const streetName = streetCodes[streetCode];
        const houseNumber = data[0].HOUSE || null;
        const consname = data[0].CONSNAME;
        const conscode = data[0].CONSCODE;
        profile += `👤 <b>[ ${conscode} ]</b>  <b><i>${consname}</i></b>\n      <b><i>${streetName} ${houseNumber}</i></b>\n`;
        for (const row of data) {
          const { WCODE, FACTNUMB } = row;
          const buttonText =
            FACTNUMB !== null ? `🔹 ${FACTNUMB.toString()}` : "не указано";
          buttons.push([Markup.button.callback(buttonText, `wcode_${WCODE}`)]);
        }
        await buttons.push([
          Markup.button.callback("Ввести другой л/c", "restart"),
        ]);
        const wcodeBtn = Markup.inlineKeyboard(buttons);
        user.data = {
          ...user.data,
          consname,
          conscode,
          streetName,
          houseNumber,
        };
        await user.save();
        await User.updateOne(
          { user_id: userId },
          { state: "insertWaterNumber" }
        );
        await ctx.replyWithHTML(profile, wcodeBtn);
      }
    } else {
      await User.updateOne({ user_id: userId }, { state: "null" });
      await ctx.replyWithHTML("Вы не авторизовались");
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

      const data = await connection.query(
        `SELECT TOP 1 WCODE,Format([LASTDATE], 'mm.yyyy') AS FormattedDate,CURRCOUNT
        FROM WCHEAP
        WHERE WCODE = ${wcode}
        ORDER BY LASTDATE DESC`
      );
      const currentDate = new Date();
      const nowDate = formatDate(currentDate);
      // const { FormattedDate, CURRCOUNT, WCODE } = data[0];
      if (data[0] == undefined) {
        const data = await connection.query(
          `SELECT WCODE,Format([DATESET], 'mm.yyyy') AS FormattedDate,STARTCOUNT AS CURRCOUNT
          FROM WCOUNT
          WHERE WCODE = ${wcode}`
        );
        const { FormattedDate, CURRCOUNT, WCODE } = data[0];
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
      } else {
        const { FormattedDate, CURRCOUNT, WCODE } = data[0];
        if (nowDate === FormattedDate) {
          ctx.reply(
            "Данные за текущий месяц уже внесены!\nВыберите другой счетчик.\nИли воспользуйтесь кнопкой",
            restart
          );
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
      }
    }
  } catch (e) {
    console.log(e);
  }
}

async function insertValue(ctx, useState) {
  try {
    const txt = ctx.message.text;
    const chatId = ctx.chat.id;
    useState[chatId].LASTCOUNT = txt;

    if (isNaN(txt)) {
      ctx.reply("Введите число!");
    } else {
      const diff = txt - useState[chatId].CURRCOUNT;

      if (diff > 50) {
        ctx.replyWithHTML(
          `Разница между введенным значением\n<b>[ ${diff} ]</b> это больше чем 50.\nНажмите  "Да", или введите другое значение`,
          yes
        );
      } else if (diff <= 50 && txt > useState[chatId].CURRCOUNT) {
        await checkConnection();
        await connection.execute(`INSERT INTO WCHEAP
        VALUES (${useState[chatId].WCODE}, Format(Date(), 'dd.mm.yyyy'), ${txt}, ${useState[chatId].CURRCOUNT}, null)
        `);
        // await connection.execute(`
        //   INSERT INTO WCHEAP
        //   VALUES (${useState[chatId].WCODE}, #02/29/2024#, ${useState[chatId].LASTCOUNT}, ${useState[chatId].CURRCOUNT}, null)
        // `);
        await ctx.reply(`Данные успешно вставлены.\nВведите другой л/с!`);
        await log(useState, authChatId, chatId);
        useState[chatId].state = "insertConscode";
      } else {
        ctx.replyWithHTML(
          `Внесенные данные меньше последнего показания <b>[ ${useState[chatId].CURRCOUNT} ]</b>\nПопробуйте внести другое значение или возпользуйтесь кнопкой для выбора другого л/c!`,
          restart
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
}

async function insertIfYes(ctx, useState) {
  try {
    const chatId = ctx.chat.id;
    await checkConnection();
    await connection.execute(`
      INSERT INTO WCHEAP
      VALUES (${useState[chatId].WCODE}, Format(Date(), 'dd.mm.yyyy'), ${useState[chatId].LASTCOUNT}, ${useState[chatId].CURRCOUNT}, null)
    `);
    // await connection.execute(`
    //   INSERT INTO WCHEAP
    //   VALUES (${useState[chatId].WCODE}, #02/29/2024#, ${useState[chatId].LASTCOUNT}, ${useState[chatId].CURRCOUNT}, null)
    // `);

    await ctx.reply("Данные успешно вставлены.");
    await ctx.reply("Введите л/с!");
    await log(useState, authChatId, chatId);
    useState[chatId].state = "insertConscode";
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  userInfoForInsert,
  wcodeInfoForInsert,
  insertValue,
  insertIfYes,
};
