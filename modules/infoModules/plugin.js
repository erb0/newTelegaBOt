const XLSX = require("xlsx");
const fs = require("fs");
const { streetCodes, locationCodes } = require("./dataObjects");

async function log(chatId, name, text, type) {
  try {
    ID = chatId;
    NAME = name;
    DATA = text;
    TYPE = type;
    const now = new Date();
    const YEAR = now.getFullYear();
    const MONTH = now.getMonth() + 1; // Месяцы в объекте Date нумеруются с 0, поэтому добавляем 1
    const DAY = now.getDate();
    const TIME = now.getHours();

    const existingFilePath = "./log.xlsx";

    const workbook = XLSX.readFile(existingFilePath);

    const sheetName = "log";

    const sheet = workbook.Sheets[sheetName];

    const newRowData = [ID, NAME, TYPE, DATA, YEAR, MONTH, DAY, TIME];

    const newRowNumber = XLSX.utils.decode_range(sheet["!ref"]).e.r + 1;

    for (let i = 0; i < newRowData.length; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: newRowNumber, c: i });
      sheet[cellAddress] = { v: newRowData[i], t: "s" };
    }

    const newRange = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: newRowData.length - 1, r: newRowNumber },
    });
    sheet["!ref"] = newRange;

    XLSX.writeFile(workbook, existingFilePath);

    console.log("Новая строка добавлена в файл Excel.");
    return true;
  } catch (error) {
    console.error(
      "Произошла ошибка при добавлении строки в файл Excel:",
      error
    );
    return false;
  }
}

async function reportLocation(chatId, searchValue, bot, connection, userState) {
  let xlsxFilePath;

  try {
    const sqlQueryForReportLocation = `
      SELECT CONSUM.FSBDVCODE, CONSUM.CONSCODE AS ConsumCode, CONSUM.STRTCODE, 
      CONSUM.HOUSE, CONSUM.CONSNAME, зTOTPAY_ALL_Тек.CONSCODE, 
      зTOTPAY_ALL_Тек.Долг, зTOTPAY_ALL_Тек.ТрфПит, 
      зTOTPAY_ALL_Тек.ТрфКан, зTOTPAY_ALL_Тек.НчслВсч
      FROM CONSUM
      INNER JOIN зTOTPAY_ALL_Тек ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE
      WHERE CONSUM.FSBDVCODE = '${searchValue}'
      ORDER BY CONSUM.STRTCODE; 
    `;

    const resSqlReport = await connection.query(sqlQueryForReportLocation);

    if (resSqlReport && resSqlReport.length > 0) {
      const locationCode = resSqlReport[0].FSBDVCODE;
      const locationName = locationCodes[locationCode]; // Убедитесь, что locationCodes определен
      const sheetData = [
        [locationName],
        [],
        [
          "Лицевой счет",
          "Улица",
          "Номер",
          "ФИО",
          "Начисление",
          "Долг",
          "ТарифПит",
          "ТарифКан",
        ],
      ];

      let totalSumDebt = 0;
      let totalSumAccrual = 0;
      let totalCount = 0;

      for (const row of resSqlReport) {
        const userId = row.ConsumCode;
        const userName = row.CONSNAME;
        const houseNumber = row.HOUSE;
        const streetCode = row.STRTCODE;
        const streetName = streetCodes[streetCode]; // Убедитесь, что streetCodes определен
        const debt = formatValue(row.Долг);
        const tarifPit = formatValue(row.ТрфПит);
        const tarifKan = formatValue(row.ТрфКан);
        const accrual = formatValue(row.НчслВсч);
        totalCount += 1;
        totalSumDebt += parseFloat(debt);
        totalSumAccrual += parseFloat(accrual);
        sheetData.push([
          userId,
          streetName,
          houseNumber,
          userName,
          accrual,
          debt,
          tarifPit,
          tarifKan,
        ]);
      }

      if (totalSumDebt > 0 || totalSumAccrual > 0) {
        sheetData.push([]);
        sheetData.push([
          "Сумма:",
          "",
          "",
          "",
          totalSumAccrual.toFixed(2),
          totalSumDebt.toFixed(2),
          "",
          "",
        ]);
        sheetData.push(["Количество:", "", "", "", totalCount, "", ""]);
      }

      const colWidths = [
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 10 },
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
      ];

      const sheet = XLSX.utils.aoa_to_sheet(sheetData);
      sheet["!cols"] = colWidths;
      const workbook = XLSX.utils.book_new();

      const currentDateTime = new Date();
      // const formattedDateTime = currentDateTime
      //   .toLocaleString("en-US")
      //   .replace(/[:/]/g, "-");
      const formattedDateTime = formatDate(currentDateTime);
      xlsxFilePath = `${searchValue} - ${formattedDateTime}.xlsx`;

      XLSX.utils.book_append_sheet(workbook, sheet, "Report");
      XLSX.writeFile(workbook, xlsxFilePath);

      await bot.sendMessage(chatId, "Ждите");
      await bot.sendDocument(chatId, xlsxFilePath);

      // Удаление временного файла
      if (xlsxFilePath && fs.existsSync(xlsxFilePath)) {
        fs.unlinkSync(xlsxFilePath);
      }

      delete userState[chatId];
    } else {
      bot.sendMessage(chatId, `Нет результатов для ${searchValue}`);
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Произошла ошибка при выполнении запроса.");
  } finally {
    // Дополнительное удаление файла в случае ошибки
    if (xlsxFilePath && fs.existsSync(xlsxFilePath)) {
      fs.unlinkSync(xlsxFilePath);
    }
  }
}

function formatValue(value) {
  return value !== null ? value.toFixed(2) : "N/A";
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return `${day}.${month}.${year}-${hours}|${minutes}`;
}

module.exports = { log, reportLocation, formatValue,formatDate };
