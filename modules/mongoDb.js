const mongoose = require('mongoose')
require('dotenv').config()

// Импортировать новую модель User из models/User.js
const { User } = require('../models/User')

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
  }
}

// УДАЛЕНО: старая схема userSchema теперь в models/User.js

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

const PhotoSchema = new mongoose.Schema({
  chatId: Number,
  name: String,
  CONSCODE: String,
  photoUrl: String,
  date: Date,
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

// User уже импортирован из models/User.js
const Consumer = mongoose.model('Consumer', consumerSchema)
const Log = mongoose.model('Log', logSchema)
const Photo = mongoose.model('Photo', PhotoSchema)

module.exports = {
  connectToDatabase,
  User,
  Consumer,
  Log,
  Photo,
  logInfoMongo,
}
