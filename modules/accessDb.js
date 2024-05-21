// const ADODB = require("node-adodb");
// ADODB.debug = true;
// // const connection = ADODB.open(
// //   `Provider=Microsoft.JET.OLEDB.4.0;
// //       Data Source=C:/sayram/sayram.mdb;
// //       Jet OLEDB:System Database=C:/sayram/sayram.mdw;
// //       User ID=карасай;
// //       Password=нтеньфл77;`
// // );

// const connection = ADODB.open(
//   `Provider=Microsoft.JET.OLEDB.4.0;
//       Data Source=//SERVERBD/sayram/Сайрам.mdb;
//       Jet OLEDB:System Database=C:/sayram/sayram.mdw;
//       User ID=карасай;
//       Password=нтеньфл77;`
// );

// function checkConnection() {
//   return new Promise((resolve, reject) => {
//     connection
//       .execute("SELECT 1")
//       .then(() => {
//         resolve();
//       })
//       .catch((error) => {
//         reject(error);
//       });
//   });
// }

// const deskCodes = {};
// const paymentCodes = {};
// const streetCodes = {};
// const locationCodes = {};

// async function populateCodes() {
//   const deskQuery = `
//     SELECT
//     PDESKCODE,
//     PDESKNAME
//     FROM PAYDESK`;

//   const paymentQuery = `
//     SELECT
//     GROUPCODE,
//     GROUPNAME
//     FROM [GROUP]`;

//   const streetQuery = `
//     SELECT
//     STRTCODE,
//     STRTNAME
//     FROM STREET`;

//   const locationQuery = `
//     SELECT
//     [FSBDVCODE],
//     [SECTNAME],
//     [CHIEFNAME]
//     FROM [SECTION]`;

//   try {
//     const [deskData, paymentData, streetData, locationData] = await Promise.all(
//       [
//         connection.query(deskQuery),
//         connection.query(paymentQuery),
//         connection.query(streetQuery),
//         connection.query(locationQuery),
//       ]
//     );

//     deskData.forEach((row) => {
//       deskCodes[row.PDESKCODE] = row.PDESKNAME;
//     });
//     await console.log("desCodes obj done!");
//     paymentData.forEach((row) => {
//       paymentCodes[row.GROUPCODE] = row.GROUPNAME;
//     });
//     await console.log("paymentCodes obj done!");

//     streetData.forEach((row) => {
//       streetCodes[row.STRTCODE] = row.STRTNAME;
//     });
//     await console.log("streetCodes obj done!");
//     locationData.forEach((row) => {
//       locationCodes[row.FSBDVCODE] = `${row.SECTNAME} - ${row.CHIEFNAME}`;
//     });
//     await console.log("locationCodes obj done!");
//   } catch (error) {
//     console.error("Error executing queries:", error);
//     throw error;
//   }
// }

// async function main() {
//   await populateCodes();
// }

// main().catch((error) => {
//   console.error("Error populating deskCodes and paymentCodes:", error);
// });

// module.exports = {
//   connection,
//   checkConnection,
//   deskCodes,
//   paymentCodes,
//   streetCodes,
// };

const ADODB = require("node-adodb");
ADODB.debug = true;

const connection = ADODB.open(
  `Provider=Microsoft.JET.OLEDB.4.0;
      Data Source=//SERVERBD/sayram/Сайрам.mdb;
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
const paymentCodes = {};
const streetCodes = {};
const locationCodes = {};

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

  const locationQuery = `
    SELECT
    [FSBDVCODE],
    [SECTNAME],
    [CHIEFNAME]
    FROM [SECTION]`;

  const queries = [
    {
      query: deskQuery,
      codeObj: deskCodes,
      codeField: "PDESKCODE",
      nameField: "PDESKNAME",
    },
    {
      query: paymentQuery,
      codeObj: paymentCodes,
      codeField: "GROUPCODE",
      nameField: "GROUPNAME",
    },
    {
      query: streetQuery,
      codeObj: streetCodes,
      codeField: "STRTCODE",
      nameField: "STRTNAME",
    },
    {
      query: locationQuery,
      codeObj: locationCodes,
      codeField: "FSBDVCODE",
      nameField: ["SECTNAME", "CHIEFNAME"],
    },
  ];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    for (let i = 0; i < queries.length; i++) {
      const { query, codeObj, codeField, nameField } = queries[i];
      const data = await connection.query(query);

      data.forEach((row) => {
        if (Array.isArray(nameField)) {
          codeObj[row[codeField]] = nameField
            .map((field) => row[field])
            .join(" - ");
        } else {
          codeObj[row[codeField]] = row[nameField];
        }
      });

      await console.log(
        `${Object.keys(codeObj).length} entries added to ${
          Object.keys({ codeObj })[0]
        }`
      );

      if (i < queries.length - 1) {
        await sleep(10000); // Ожидание 10 секунд перед следующим запросом
      }
    }
  } catch (error) {
    console.error("Error executing queries:", error);
    throw error;
  }
}

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
  locationCodes,
};
