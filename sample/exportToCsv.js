// Функция для извлечения данных из MongoDB

const { Parser } = require("json2csv");
const fs = require("fs");

async function getMeterReadings(userId, MeterReading) {
  try {
    const readings = await MeterReading.find({ user_id: userId }).sort({
      date: -1,
    });
    return readings;
  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    throw error;
  }
}

// Функция для экспорта данных в CSV

async function exportToCsv(userId, MeterReading) {
  try {
    const readings = await getMeterReadings(userId, MeterReading);

    if (readings.length === 0) {
      console.log("Нет данных для указанного пользователя.");
      return;
    }

    const fields = ["user_id", "WCODE", "LASTCOUNT", "PREVCOUNT", "date"];
    const opts = { fields };

    const parser = new Parser(opts);
    const csv = parser.parse(readings);

    const fileName = `meter_readings_${userId}.csv`;
    fs.writeFileSync(fileName, csv);

    console.log(`Данные успешно экспортированы в файл ${fileName}`);
  } catch (error) {
    console.error("Ошибка при экспорте данных в CSV:", error);
  }
}

// Пример использования

const {
  connectToDatabase,
  User,
  MeterReading,
} = require("./path_to_your_mongoose_setup");

async function main() {
  await connectToDatabase();

  const userId = 123; // Замените на нужный ID пользователя

  await exportToCsv(userId, MeterReading);
}

main().catch(console.error);
