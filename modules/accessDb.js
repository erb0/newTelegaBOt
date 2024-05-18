const ADODB = require("node-adodb");
ADODB.debug = true;
const connection = ADODB.open(
  `Provider=Microsoft.JET.OLEDB.4.0;
      Data Source=C:/sayram/sayram.mdb;
      Jet OLEDB:System Database=C:/sayram/sayram.mdw;
      User ID=карасай;
      Password=нтеньфл77;`
);

function checkConnection() {
  return new Promise((resolve, reject) => {
    connection
      .execute("SELECT 1")
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

const deskCodes = {};
const paymentCodes = {}; // Создаем объект для хранения кодов оплат
const streetCodes = {};
// Функция для заполнения deskCodes и paymentCodes данными из базы данных
async function populateCodes() {
  const deskQuery = `
    SELECT
    PDESKCODE,
    PDESKNAME
    FROM PAYDESK`;

  const paymentQuery = `
    SELECT
    GROUPCODE,
    GROUPNAME
    FROM [GROUP]`;

  const streetQuery = `
    SELECT
    STRTCODE,
    STRTNAME
    FROM STREET`;

  try {
    const [deskData, paymentData, streetData] = await Promise.all([
      connection.query(deskQuery),
      connection.query(paymentQuery),
      connection.query(streetQuery),
    ]);

    deskData.forEach((row) => {
      deskCodes[row.PDESKCODE] = row.PDESKNAME;
    });

    paymentData.forEach((row) => {
      paymentCodes[row.GROUPCODE] = row.GROUPNAME;
    });

    streetData.forEach((row) => {
      streetCodes[row.STRTCODE] = row.STRTNAME;
    });
  } catch (error) {
    console.error("Error executing queries:", error);
    throw error;
  }
}

// Заполняем объекты данными из базы данных перед экспортом модуля
async function main() {
  await populateCodes();
}

main().catch((error) => {
  console.error("Error populating deskCodes and paymentCodes:", error);
});

module.exports = {
  connection,
  checkConnection,
  deskCodes,
  paymentCodes,
  streetCodes,
};
