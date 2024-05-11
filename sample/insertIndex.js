const setupBot = require("./moduleInsert/bot");

const botTelegraf = setupBot();

botTelegraf.launch().then(() => {
  console.log("Bot started...");
});
