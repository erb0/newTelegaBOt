const mongoose = require("mongoose");
require("dotenv").config();

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
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
  data: Object,
  privileges: [String],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

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
});

const User = mongoose.model("User", userSchema);
const Consumer = mongoose.model("Consumer", consumerSchema);

module.exports = { connectToDatabase, User, Consumer };
