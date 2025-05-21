//MONGO

const mongoose = require("mongoose");
require("dotenv").config();

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

const userSchema = new mongoose.Schema({
  user_id: { type: Number, required: true },
  username: String,
  first_name: String,
  last_name: String,
  language_code: String,
  state: String,
  data: {
    CURRCOUNT: Number,
    WCODE: String,
    LASTCOUNT: Number,
  },
  privileges: [String],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

const meterReadingSchema = new mongoose.Schema({
  user_id: { type: Number, required: true },
  WCODE: { type: String, required: true },
  LASTCOUNT: { type: Number, required: true },
  PREVCOUNT: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

const MeterReading = mongoose.model("MeterReading", meterReadingSchema);

module.exports = { connectToDatabase, User, MeterReading };

// UPD function

async function insertValue(chatId, text, ctx, User, MeterReading) {
  try {
    const user = await User.findOne({ user_id: chatId });

    if (!user) {
      return ctx.reply("Пользователь не найден.");
    }

    if (isNaN(text) || parseInt(text) < 0) {
      return ctx.reply("Введите положительное число!");
    }

    const LASTCOUNT = parseInt(text);
    const { CURRCOUNT, WCODE } = user.data;
    const diff = LASTCOUNT - CURRCOUNT;

    if (diff > 50) {
      return ctx.replyWithHTML(
        `Разница между введенным значением\n<b>[ ${diff} ]</b> это больше чем 50.\nНажмите "Да", или введите другое значение`,
        yes
      );
    } else if (diff <= 50 && LASTCOUNT > CURRCOUNT) {
      const currentDate = new Date();

      // Сохранение показаний в отдельную коллекцию MeterReading
      const meterReading = new MeterReading({
        user_id: chatId,
        WCODE,
        LASTCOUNT,
        PREVCOUNT: CURRCOUNT,
        date: currentDate,
      });

      await meterReading.save();

      // Обновление текущего значения в данных пользователя
      user.data.LASTCOUNT = LASTCOUNT;
      await user.save();

      await ctx.reply("Данные успешно вставлены.\nВведите другой л/с!");
      await User.updateOne({ user_id: chatId }, { state: "insertConscode" });
    } else {
      return ctx.replyWithHTML(
        `Внесенные данные меньше последнего показания <b>[${CURRCOUNT}]</b>\nВнесите другое значение или воспользуйтесь кнопкой для выбора другого л/c!`,
        restart
      );
    }
  } catch (error) {
    console.log("Общая ошибка:", error);
    return ctx.reply("Произошла ошибка. Попробуйте еще раз позже.");
  }
}
