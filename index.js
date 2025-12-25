const botStart = require("./bot");
const { accessDbManager } = require("./modules/accessDb");

async function initializeApp() {
  try {
    console.log("Инициализация приложения...");

    // Инициализация AccessDB и загрузка справочников
    await accessDbManager.initialize();

    // Запуск автообновления кеша каждый час
    accessDbManager.startAutoRefresh();

    // Запуск бота
    const bot = botStart();
    bot.launch();

    console.log("✅ Приложение успешно запущено");
  } catch (error) {
    console.error("❌ Ошибка инициализации приложения:", error);
    process.exit(1);
  }
}

// Запуск приложения
initializeApp();
