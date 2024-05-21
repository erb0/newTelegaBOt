const XLSX = require("xlsx");
const fs = require("fs");
const { streetCodes, locationCodes, connection } = require("../accessDb");
const { formatDate, formatValue } = require("../plugin");

// async function reportLocation(chatId, searchValue, ctx, connection, User) {
//   try {
//     // const query = `
//     //     SELECT
//     //     CONSUM.FSBDVCODE,
//     //     CONSUM.CONSCODE AS ConsumCode,
//     //     CONSUM.STRTCODE,
//     //     CONSUM.HOUSE,
//     //     CONSUM.CONSNAME,
//     //     зTOTPAY_ALL_Тек.CONSCODE,
//     //     зTOTPAY_ALL_Тек.Долг,
//     //     зTOTPAY_ALL_Тек.ТрфПит,
//     //     зTOTPAY_ALL_Тек.ТрфКан,
//     //     зTOTPAY_ALL_Тек.НчслВсч
//     //     FROM CONSUM
//     //     INNER JOIN зTOTPAY_ALL_Тек ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE
//     //     WHERE CONSUM.FSBDVCODE = '${searchValue}'
//     //     ORDER BY CONSUM.STRTCODE;
//     //   `;
//     const query = `
// SELECT
// conscode,
// consname,
// street,
// house,
// newDebt
// FROM [1_CONSUMER_INFO]
// WHERE locationCode = '${searchValue}'
// ORDER BY street
//   `;

//     const data = await connection.query(query);

//     if (data && data.length > 0) {
//       const locationCode = data[0].FSBDVCODE;
//       const locationName = locationCodes[locationCode]; // Убедитесь, что locationCodes определен
//       const sheetData = [
//         [locationName],
//         [],
//         [
//           "Лицевой счет",
//           "Улица",
//           "Номер",
//           "ФИО",
//           "Начисление",
//           "Долг",
//           "ТарифПит",
//           "ТарифКан",
//         ],
//       ];

//       let totalSumDebt = 0;
//       let totalSumAccrual = 0;
//       let totalCount = 0;

//       for (const row of data) {
//         const userId = row.ConsumCode;
//         const userName = row.CONSNAME;
//         const houseNumber = row.HOUSE;
//         const streetCode = row.STRTCODE;
//         const streetName = streetCodes[streetCode]; // Убедитесь, что streetCodes определен
//         const debt = formatValue(row.Долг);
//         const tarifPit = formatValue(row.ТрфПит);
//         const tarifKan = formatValue(row.ТрфКан);
//         const accrual = formatValue(row.НчслВсч);
//         totalCount += 1;
//         totalSumDebt += parseFloat(debt);
//         totalSumAccrual += parseFloat(accrual);
//         sheetData.push([
//           userId,
//           streetName,
//           houseNumber,
//           userName,
//           accrual,
//           debt,
//           tarifPit,
//           tarifKan,
//         ]);
//       }

//       if (totalSumDebt > 0 || totalSumAccrual > 0) {
//         sheetData.push([]);
//         sheetData.push([
//           "Сумма:",
//           "",
//           "",
//           "",
//           totalSumAccrual.toFixed(2),
//           totalSumDebt.toFixed(2),
//           "",
//           "",
//         ]);
//         sheetData.push(["Количество:", "", "", "", totalCount, "", ""]);
//       }

//       const colWidths = [
//         { wch: 10 },
//         { wch: 10 },
//         { wch: 20 },
//         { wch: 10 },
//         { wch: 20 },
//         { wch: 10 },
//         { wch: 10 },
//         { wch: 10 },
//       ];

//       const sheet = XLSX.utils.aoa_to_sheet(sheetData);
//       sheet["!cols"] = colWidths;
//       const workbook = XLSX.utils.book_new();

//       const currentDateTime = new Date();
//       // const formattedDateTime = currentDateTime
//       //   .toLocaleString("en-US")
//       //   .replace(/[:/]/g, "-");
//       const formattedDateTime = formatDate(currentDateTime);
//       const xlsxFilePath = `${searchValue} - ${formattedDateTime}.xlsx`;

//       XLSX.utils.book_append_sheet(workbook, sheet, "Report");
//       XLSX.writeFile(workbook, xlsxFilePath);

//       await bot.sendMessage(chatId, "Ждите");
//       await bot.sendDocument(chatId, xlsxFilePath);

//       // Удаление временного файла
//       if (xlsxFilePath && fs.existsSync(xlsxFilePath)) {
//         fs.unlinkSync(xlsxFilePath);
//       }

//       delete userState[chatId];
//     } else {
//       bot.sendMessage(chatId, `Нет результатов для ${searchValue}`);
//     }
//   } catch (error) {
//     console.error(error);
//     bot.sendMessage(chatId, "Произошла ошибка при выполнении запроса.");
//   } finally {
//     // Дополнительное удаление файла в случае ошибки
//     if (xlsxFilePath && fs.existsSync(xlsxFilePath)) {
//       fs.unlinkSync(xlsxFilePath);
//     }
//   }
// }

async function reportLocation(searchValue) {
  try {
    const query = `
  SELECT
  conscode,
  consname,
  street,
  house,
  newDebt
  FROM [1_CONSUMER_INFO]
  WHERE locationCode = '${searchValue}'
  ORDER BY street
    `;

    const data = await connection.query(query);

    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

reportLocation("2101");
