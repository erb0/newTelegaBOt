const { connectToDatabase, Consumer } = require("./mongoDb");
const { connection } = require("./accessDb");
const cron = require("node-cron");
const path = require("path");

connectToDatabase();
// Функция для получения данных из Access
async function fetchDataFromAccess() {
  try {
    const query = `
    SELECT *
    FROM [1_CONSUMER_INFO]`;

    const data = await connection.query(query);
    console.log(`Acces data comlete`);
    return data;
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

// Функция для обновления данных в MongoDB
async function updateMongoDB(data) {
  try {
    let qty = 0;
    for (const item of data) {
      qty++;
      await Consumer.updateOne(
        { conscode: item.conscode },
        { $set: item },
        { upsert: true } // Вставка документа, если он не существует
      );
      console.log(`Insert success document  № ${qty}`);
    }
    console.log("Data updated successfully");
  } catch (error) {
    console.error("Error updating data:", error);
  }
}

// Функция для получения данных из Access и обновления MongoDB
async function fetchAndUpdate() {
  const data = await fetchDataFromAccess();
  if (data) {
    await updateMongoDB(data);
  }
}

// Настройка cron для выполнения fetchAndUpdate каждые 2 часа
// cron.schedule("0 */2 * * *", () => {
//   console.log("Fetching and updating data...");
fetchAndUpdate();
// });

// async function testQuery() {
//   try {
//     const query = `SELECT TOP 3 *
//     FROM [1_CONSUMER_INFO]`;

//     const data = await connection.query(query);
//     console.log(data);
//   } catch (error) {
//     console.log(error);
//   }
// }
// testQuery();
