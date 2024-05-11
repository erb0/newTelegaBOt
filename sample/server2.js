const express = require("express");
const { connection } = require("./module/conectionDb");

const app = express();
const PORT = 3000;

app.use(express.json());

let data = [];

const initializeData = async () => {
  await syncData();
  setInterval(syncData, 60000);
};

const syncData = async () => {
  const sql = "SELECT * FROM [1_JSON_CONSUMER_INFO]";

  try {
    const newData = await connection.query(sql);
    data = newData;
    console.log("Данные успешно обновлены.");
  } catch (error) {
    console.error("Ошибка при обновлении данных:", error);
  }
};

initializeData();

app.get("/data", (req, res) => {
  if (data) {
    res.send(data);
  } else {
    res.status(404).json({ error: "Not Found" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
