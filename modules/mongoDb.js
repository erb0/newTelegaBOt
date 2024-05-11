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

const User = mongoose.model("User", userSchema);

module.exports = { connectToDatabase, User };
