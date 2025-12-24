const mongoose = require('mongoose')
require('dotenv').config()

// Импортировать новую модель User из models/User.js
const { User } = require('../models/User')

async function connectToDatabase() {
  try {
    // Используем MONGODB_TOOST_URI для подключения к БД toostbot
    const uri = process.env.MONGODB_TOOST_URI || process.env.MONGODB_URI
    await mongoose.connect(uri)
    console.log('Connected to MongoDB (toostbot database)')
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

// Схема для логов показаний абонентов
const insertLogSchema = new mongoose.Schema({
  inspectorName: { type: String, required: true },
  inspectorId: { type: Number, required: true },
  conscode: { type: Number, required: true },
  consname: { type: String, required: true },
  streetName: String,
  house: String,
  WCODE: String,
  CURRCOUNT: { type: Number, required: true },
  LASTCOUNT: { type: Number, required: true },
  diff: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
})

// Схема для логов ошибок
const errorLogSchema = new mongoose.Schema({
  errorMessage: { type: String, required: true },
  errorStack: String,
  context: { type: String, required: true }, // функция/модуль где произошла ошибка
  userId: Number,
  userName: String,
  additionalData: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
})

const PhotoSchema = new mongoose.Schema({
  chatId: Number,
  name: String,
  CONSCODE: String,
  photoUrl: String,
  date: Date,
})


// User уже импортирован из models/User.js
const Consumer = mongoose.model('Consumer', consumerSchema)
const Log = mongoose.model('Log', logSchema)
const InsertLog = mongoose.model('InsertLog', insertLogSchema)
const ErrorLog = mongoose.model('ErrorLog', errorLogSchema)
const Photo = mongoose.model('Photo', PhotoSchema)

module.exports = {
  connectToDatabase,
  User,
  Consumer,
  Log,
  InsertLog,
  ErrorLog,
  Photo,
}
