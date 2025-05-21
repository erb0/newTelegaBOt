const mongoose = require('mongoose')
require('dotenv').config()

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
  }
}
const userSchema = new mongoose.Schema({
  user_id: { type: Number, required: true },
  username: String,
  first_name: String,
  last_name: String,
  language_code: String,
  state: String,
  data: Object,
  privileges: [String],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
})

const consumerSchema = new mongoose.Schema({
  conscode: Number,
  consname: String,
  sectionName: String,
  inspectorName: String,
  type: String,
  street: String,
  house: String,
  debt: Number,
  payment: Number,
  meterReading: Number,
  accrual: Number,
  newDebt: Number,
  w: Number,
  ww: Number,
})

const logSchema = new mongoose.Schema({
  chatId: Number,
  name: String,
  type: String,
  data: String,
  timestamp: { type: Date, default: Date.now },
})

async function logInfoMongo(chatId, name, text, type, ctx) {
  try {
    const logEntry = new Log({
      chatId,
      name,
      type,
      data: text,
    })
    await logEntry.save()
    // await ctx.telegram.sendMessage(498318670, `${name} [${type}]- ${text}`);
  } catch (error) {
    console.error('Ошибка при логировании в MongoDB:', error)
  }
}
const User = mongoose.model('User', userSchema)
const Consumer = mongoose.model('Consumer', consumerSchema)
const Log = mongoose.model('Log', logSchema)

module.exports = {
  connectToDatabase,
  User,
  Consumer,
  Log,
  logInfoMongo,
}
