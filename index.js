const botStart = require("./bot");
const { main } = require("./modules/accessDb");

async function initializeApp() {
  try {
    // Инициализация базы данных и заполнение объектов кодов
    await main();

    // Запуск бота
    const bot = botStart();
    bot.launch();

    console.log("Application has been initialized successfully.");
  } catch (error) {
    console.error("Error initializing the application:", error);
  }
}

// Запуск приложения
initializeApp();
