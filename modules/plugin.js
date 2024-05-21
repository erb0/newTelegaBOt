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

module.exports = {
  log,
  formatDate,
  formatValue,
};
