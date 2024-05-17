const fs = require("fs");
const XLSX = require("xlsx");
const path = require("path");

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}.${year}`;
}

async function log(useState, authChatId, chatId) {
  try {
    const inspectorName = authChatId[chatId].name;
    const conscode = useState[chatId].conscode;
    const consname = useState[chatId].consname;
    const streetName = useState[chatId].streetName;
    const houseNumber = useState[chatId].houseNumber;
    const wcode = useState[chatId].WCODE;
    const currcount = useState[chatId].CURRCOUNT;
    const lastcount = useState[chatId].LASTCOUNT;
    const now = new Date();
    const YEAR = now.getFullYear();
    const MONTH = now.getMonth() + 1;
    const DAY = now.getDate();
    const TIME = now.getHours();
    const MINUTE = now.getMinutes();

    const existingFilePath = path.join(__dirname, `${inspectorName}.xlsx`);

    const directory = path.dirname(existingFilePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
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

    // Check if sheet has a reference, if not, initialize it
    if (!sheet["!ref"]) {
      sheet["!ref"] = "A1";
    }

    const newRowData = [
      inspectorName,
      conscode,
      consname,
      streetName,
      houseNumber,
      wcode,
      currcount,
      lastcount,
      YEAR,
      MONTH,
      DAY,
      TIME,
    ];

    const newRowNumber = XLSX.utils.decode_range(sheet["!ref"]).e.r + 1;

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
  formatDate,
  log,
};

// const XLSX = require("xlsx");
// const path = require("path");

// function formatDate(date) {
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const year = date.getFullYear();
//   return `${month}.${year}`;
// }

// async function log(useState, authChatId, chatId) {
//   try {
//     const inspectorName = authChatId[chatId].name;
//     const conscode = useState[chatId].conscode;
//     const consname = useState[chatId].consname;
//     const streetName = useState[chatId].streetName;
//     const houseNumber = useState[chatId].houseNumber;
//     const wcode = useState[chatId].WCODE;
//     const currcount = useState[chatId].CURRCOUNT;
//     const lastcount = useState[chatId].LASTCOUNT;
//     const now = new Date();
//     const YEAR = now.getFullYear();
//     const MONTH = now.getMonth() + 1;
//     const DAY = now.getDate();
//     const TIME = now.getHours();
//     const MINUTE = now.getMinutes();

//     const existingFilePath = path.join(__dirname, "log.xlsx");

//     const workbook = XLSX.readFile(existingFilePath);

//     const sheetName = "log";

//     const sheet = workbook.Sheets[sheetName];

//     const newRowData = [
//       inspectorName,
//       conscode,
//       consname,
//       streetName,
//       houseNumber,
//       wcode,
//       currcount,
//       lastcount,
//       YEAR,
//       MONTH,
//       DAY,
//       TIME,
//     ];

//     const newRowNumber = XLSX.utils.decode_range(sheet["!ref"]).e.r + 1;

//     for (let i = 0; i < newRowData.length; i++) {
//       const cellAddress = XLSX.utils.encode_cell({ r: newRowNumber, c: i });
//       sheet[cellAddress] = { v: newRowData[i], t: "s" };
//     }

//     const newRange = XLSX.utils.encode_range({
//       s: { c: 0, r: 0 },
//       e: { c: newRowData.length - 1, r: newRowNumber },
//     });
//     sheet["!ref"] = newRange;

//     XLSX.writeFile(workbook, existingFilePath);

//     console.log(
//       `${inspectorName} - [ ${conscode} ]  ${DAY}/${MONTH}  ${TIME}:${MINUTE}`
//     );
//     return true;
//   } catch (error) {
//     console.error(
//       "Произошла ошибка при добавлении строки в файл Excel:",
//       error
//     );
//     return false;
//   }
// }
// module.exports = {
//   formatDate,
//   log,
// };
