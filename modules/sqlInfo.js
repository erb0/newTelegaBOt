const { query, accessDbManager } = require("./accessDb");
const { menu, cheap, payments, byWm } = require("./button");
const path = require("path");
const axios = require("axios");
const LogService = require("../services/LogService");

function validateNumberInput(input, ctx) {
  if (isNaN(input)) {
    ctx.reply("Введите число!");
    return false;
  }
  return true;
}

function buildUserProfile(data, searchValue) {
  const { consname, streetCode, house, debt, dateRep, w, ww } = data;
  const streetName = accessDbManager.streetCodes[streetCode] || "Неизвестная улица";
  const wCheckBox = w > 0 ? "✅" : "❌";
  const wwCheckBox = ww > 0 ? "✅" : "❌";
  return `👤 ( ${searchValue} ) ${consname}
🏡 адрес: ${streetName} ${house}
💰 долг: ${debt.toFixed(2)} тг
📅 дата расчета: ${dateRep.slice(0, 10)}
📑 тариф
${wCheckBox} вода: ${w.toFixed(2)} тг
${wwCheckBox} канализация: ${ww.toFixed(2)} тг`;
}

async function searchByUser(locationCodeArray, searchValue, ctx, User) {
  let currentUser; // Declare outside try block for catch block access
  try {
    if (!validateNumberInput(searchValue, ctx)) return;

    const chatId = ctx.from.id;

    // Получить имя из MongoDB
    currentUser = await User.findOne({ user_id: chatId });
    const name = currentUser?.first_name || "Неизвестный";

    // Логирование через LogService
    const logService = new LogService();
    await logService.logSearch(chatId, name, "Лсчет", searchValue, ctx);

    // Если locationCodeArray = null, админ/ревизор может искать по всем участкам
    const whereClause = locationCodeArray === null
      ? `WHERE CONSUM.CONSCODE = ${searchValue}`
      : `WHERE CONSUM.FSBDVCODE IN (${locationCodeArray}) AND CONSUM.CONSCODE = ${searchValue}`;

    const sqlQuery = `SELECT CONSUM.CONSNAME AS consname, CONSUM.STRTCODE AS streetCode, CONSUM.HOUSE AS house,
                   зTOTPAY_ALL_Тек.Долг AS debt, зTOTPAY_ALL_Тек.ДатаРсч AS dateRep,
                   зTOTPAY_ALL_Тек.ТрфПит AS w, зTOTPAY_ALL_Тек.ТрфКан AS ww
                   FROM CONSUM INNER JOIN зTOTPAY_ALL_Тек
                   ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE
                   ${whereClause};`;

    const data = await query(sqlQuery);

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
    const logService = new LogService();
    await logService.logError(error, "searchByUser", ctx.from.id, currentUser?.first_name);
    console.error("Ошибка при выполнении запроса:", error);
    await ctx.reply(
      "Произошла ошибка при выполнении запроса. Попробуйте позже."
    );
  }
}

async function searchWmOrName(text, ctx, searchField, User) {
  let currentUser; // Declare outside try block for catch block access
  try {
    const chatId = ctx.from.id;

    // Получить имя из MongoDB
    currentUser = await User.findOne({ user_id: chatId });
    const name = currentUser?.first_name || "Неизвестный";

    // Логирование через LogService
    const logService = new LogService();
    await logService.logSearch(chatId, name, searchField === "wm" ? "в/м" : "фио", text, ctx);

    const sqlQuery = `SELECT * FROM з_АбонентыВМ WHERE [${searchField}] LIKE '%${text}%'`;
    const data = await query(sqlQuery);

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
    const logService = new LogService();
    const currentUser = await User.findOne({ user_id: ctx.from.id });
    await logService.logError(error, "searchWmOrName", ctx.from.id, currentUser?.first_name);
    console.error("Ошибка при выполнении запроса:", error);
  }
}

const searchByWm = (text, ctx, User) =>
  validateNumberInput(text, ctx) && searchWmOrName(text, ctx, "wm", User);
const searchByName = (text, ctx, User) => searchWmOrName(text, ctx, "name", User);

async function searchPayment(User, ctx) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });

    let message = `👤 ( ${user.data.searchValue} ) ${user.data.consname}
Список последних оплат:
📅 Дата 💳 Касса 📑 Вид.опл 💰 Сумма\n`;
    const sqlQuery = `SELECT TOP 12 SUMMA AS summa,
                      PDESKCODE AS deskCode,
                      PDATE AS pdate,
                      GROUPCODE AS paymentCode
                      FROM HEAP WHERE CONSCODE = ${user.data.searchValue}
                      ORDER BY PDATE DESC`;

    const data = await query(sqlQuery);

    if (data.length > 0) {
      message += data
        .map(({ summa, deskCode, pdate, paymentCode }) => {
          return `${pdate.substring(0, 10)}, ${accessDbManager.deskCodes[deskCode] || ""}, ${
            accessDbManager.paymentCodes[paymentCode] || ""
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
    const logService = new LogService();
    const user = await User.findOne({ user_id: ctx.from.id });
    await logService.logError(error, "searchPayment", ctx.from.id, user?.first_name);
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function searchCheap(User, ctx) {
  try {
    const chatId = ctx.from.id;
    const user = await User.findOne({ user_id: chatId });
    const searchQuery = `SELECT DISTINCT WCODE,
                         FACTNUMB,
                         DATESET
                         FROM WCOUNT
                         WHERE CONSCODE = ${user.data.searchValue}`;
    const waterMeters = await query(searchQuery);

    let formattedResult = `👤 ( ${user.data.searchValue} ) ${user.data.consname}\n`;

    for (const { WCODE, FACTNUMB, DATESET } of waterMeters) {
      formattedResult += `Номер водомера: ${FACTNUMB}\nДата установки: ${DATESET.slice(
        0,
        10
      )}\n📅 Дата | 📋Показания\n`;

      const result = await query(
        `SELECT TOP 12 CURRCOUNT,
         LASTDATE
         FROM WCHEAP
         WHERE WCODE = ${WCODE}
         ORDER BY LASTDATE DESC`
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
    const logService = new LogService();
    const user = await User.findOne({ user_id: ctx.from.id });
    await logService.logError(error, "searchCheap", ctx.from.id, user?.first_name);
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
    const logService = new LogService();
    const user = await User.findOne({ user_id: ctx.from.id });
    await logService.logError(error, "back", ctx.from.id, user?.first_name);
    console.error("Ошибка при выполнении запроса:", error);
  }
}

async function handlePhotoUpload(ctx, conscode, supabase, PhotoModel) {
  try {
    const file = ctx.message.photo.pop();
    const fileId = file.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    const now = new Date();
    // const fileName = `${conscode}_${now
    //   .toLocaleDateString("ru-RU")
    //   .replace(/\//g, ".")}.jpg`;

    // const fileName = `${conscode}_${now
    //   .toLocaleString("ru-RU", {
    //     day: "2-digit",
    //     month: "2-digit",
    //     year: "numeric",
    //     hour: "2-digit",
    //     minute: "2-digit",
    //     second: "2-digit",
    //   })
    //   .replace(/[\/:\s]/g, ".")}.jpg`;

    const datePart = now.toLocaleDateString("ru-RU").replace(/\//g, ".");
    const timePart = now
      .toLocaleTimeString("ru-RU", { hour12: false })
      .replace(/:/g, ".");

    const fileName = `${conscode}_${datePart}.${timePart}.jpg`;

    const response = await axios.get(fileLink.href, {
      responseType: "arraybuffer",
    });

    // Загрузка в Supabase
    const { error: uploadError } = await supabase.storage
      .from("meters") // имя bucket
      .upload(`meters/${fileName}`, response.data, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Ошибка Supabase:", uploadError);
      return ctx.reply("❌ Не удалось загрузить фото");
    }

    // Получение публичной ссылки
    const { data: publicUrlData } = supabase.storage
      .from("meters")
      .getPublicUrl(`meters/${fileName}`);

    // Сохраняем в MongoDB
    await PhotoModel.create({
      chatId: ctx.chat.id,
      name: ctx.from.first_name,
      CONSCODE: conscode,
      photoUrl: publicUrlData.publicUrl,
      date: now,
    });

    await ctx.reply("✅ Фото успешно загружено!");
  } catch (err) {
    const logService = new LogService();
    await logService.logError(err, "handlePhotoUpload", ctx.chat.id, ctx.from.first_name, { conscode });
    console.error("Ошибка при загрузке фото:", err);
    await ctx.reply("⚠️ Произошла ошибка при загрузке фото");
  }
}

module.exports = {
  searchByName,
  searchPayment,
  searchCheap,
  searchByUser,
  searchByWm,
  back,
  handlePhotoUpload,
};
