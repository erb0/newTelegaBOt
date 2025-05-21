const fs = require("fs");
const XLSX = require("xlsx");
const path = require("path");

function formatValue(value) {
  return value !== null ? value.toFixed(2) : "N/A";
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}.${year}`;
}

async function log(user, authChatId, chatId, ctx) {
  try {
    const {
      consname,
      conscode,
      streetName,
      house,
      WCODE,
      CURRCOUNT,
      LASTCOUNT,
    } = user.data;
    const diff = LASTCOUNT - CURRCOUNT;
    const inspectorName = authChatId[chatId].name;
    const message = `${inspectorName} поставил абоненту \n{${conscode}] ${consname}  ${diff} м3`;
    if (diff >= 100) {
      await ctx.telegram.sendMessage(498318670, message);
    }
    const now = new Date();
    const YEAR = now.getFullYear();
    const MONTH = now.getMonth() + 1;
    const DAY = now.getDate();
    const TIME = now.getHours();
    const MINUTE = now.getMinutes();

    // Путь к файлу, включая директорию 'log'
    const logDir = path.join(__dirname, "log");
    const existingFilePath = path.join(logDir, `${inspectorName}.xlsx`);

    // Создаем директорию 'log', если она не существует
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    let workbook;
    if (fs.existsSync(existingFilePath)) {
      workbook = XLSX.readFile(existingFilePath);
    } else {
      workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, sheet, "log");
    }

    const sheetName = "log";
    const sheet = workbook.Sheets[sheetName];

    // Проверяем наличие референса у листа и инициализируем его, если его нет
    if (!sheet["!ref"]) {
      const headers = [
        "Контролер",
        "Лсчет",
        "ФИО",
        "Улица",
        "Дом",
        "Код водомера",
        "Текущие показания",
        "Последние показания",
        "Разница",
        "Год",
        "Месяц",
        "День",
        "Час",
        "Минута",
      ];
      for (let i = 0; i < headers.length; i++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: i });
        sheet[cellAddress] = { v: headers[i], t: "s" };
      }
      sheet["!ref"] = XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: headers.length - 1, r: 0 },
      });
    }

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const newRowNumber = range.e.r + 1;

    const newRowData = [
      inspectorName,
      conscode,
      consname,
      streetName,
      house,
      WCODE,
      CURRCOUNT,
      LASTCOUNT,
      diff,
      YEAR,
      MONTH,
      DAY,
      TIME,
      MINUTE,
    ];

    for (let i = 0; i < newRowData.length; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: newRowNumber, c: i });
      sheet[cellAddress] = { v: newRowData[i], t: "s" };
    }

    const newSheetRange = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: newRowData.length - 1, r: newRowNumber },
    });
    sheet["!ref"] = newSheetRange;

    XLSX.writeFile(workbook, existingFilePath);

    console.log(
      `${inspectorName} - [ ${conscode} ]  ${DAY}/${MONTH}  ${TIME}:${MINUTE}`
    );
    return true;
  } catch (error) {
    console.error(
      "Произошла ошибка при добавлении строки в файл Excel:",
      error
    );
    return false;
  }
}

async function logInfo(chatId, name, text, type, ctx) {
  try {
    const ID = chatId;
    const NAME = name;
    const DATA = text;
    const TYPE = type;
    const now = new Date();
    const YEAR = now.getFullYear();
    const MONTH = now.getMonth() + 1; // Месяцы в объекте Date нумеруются с 0, поэтому добавляем 1
    const DAY = now.getDate();
    const TIME = now.getHours();
    console.log(`${NAME} [${TYPE}]- ${DATA}`);
    const existingFilePath = "./modules/log/log.xlsx";
    const dir = path.dirname(existingFilePath);

    // Создаем директорию, если она не существует
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let workbook;
    let sheet;
    const sheetName = "log";

    // Проверяем, существует ли файл
    if (fs.existsSync(existingFilePath)) {
      workbook = XLSX.readFile(existingFilePath);
      sheet = workbook.Sheets[sheetName];
    } else {
      workbook = XLSX.utils.book_new();
      sheet = XLSX.utils.aoa_to_sheet([
        ["ID", "NAME", "TYPE", "DATA", "YEAR", "MONTH", "DAY", "TIME"],
      ]); // Заголовки столбцов
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    }

    const newRowData = [ID, NAME, TYPE, DATA, YEAR, MONTH, DAY, TIME].map(
      String
    );

    let range = XLSX.utils.decode_range(sheet["!ref"]);
    const newRowNumber = range.e.r + 1;

    for (let i = 0; i < newRowData.length; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: newRowNumber, c: i });
      sheet[cellAddress] = { v: newRowData[i], t: "s" };
    }

    range = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: newRowData.length - 1, r: newRowNumber },
    });
    sheet["!ref"] = range;

    XLSX.writeFile(workbook, existingFilePath);

    await ctx.telegram.sendMessage(498318670, `${NAME} [${TYPE}]- ${DATA}`);
    return true;
  } catch (error) {
    console.error(
      "Произошла ошибка при добавлении строки в файл Excel:",
      error
    );
    return false;
  }
}

async function exportMongoLogsToExcel(Log, ctx) {
  try {
    const logs = await Log.find().lean();
    if (logs.length === 0) {
      await ctx.reply("Нет логов для экспорта.");
      return;
    }

    const headers = ["Chat ID", "Name", "Type", "Data", "Date", "Time"];
    const rows = logs.map((log) => {
      const dateObj = new Date(log.timestamp);
      const date = new Date(
        dateObj.getFullYear(),
        dateObj.getMonth(),
        dateObj.getDate()
      ); // только дата
      const time = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      return [log.chatId, log.name, log.type, log.data, date, time];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Проставляем правильный тип данных
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let row = 1; row <= range.e.r; row++) {
      const dateCell = XLSX.utils.encode_cell({ r: row, c: 4 }); // Date
      const timeCell = XLSX.utils.encode_cell({ r: row, c: 5 }); // Time

      // Применяем формат к дате
      if (worksheet[dateCell] && worksheet[dateCell].v instanceof Date) {
        worksheet[dateCell].t = "d";
        worksheet[dateCell].z = "dd.mm.yyyy";
      }

      // Применяем формат к времени
      if (worksheet[timeCell]) {
        worksheet[timeCell].t = "s"; // строка, например "14:23"
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MongoLogs");

    const logDir = path.join(__dirname, "log");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const exportPath = path.join(logDir, "mongo_logs_export.xlsx");
    XLSX.writeFile(workbook, exportPath);

    await ctx.replyWithDocument({ source: exportPath });
    console.log("MongoDB логи экспортированы и отправлены:", exportPath);
  } catch (error) {
    console.error("Ошибка при экспорте логов:", error);
    await ctx.reply("Ошибка при экспорте логов.");
  }
}

module.exports = {
  log,
  formatDate,
  formatValue,
  logInfo,
  exportMongoLogsToExcel,
};
