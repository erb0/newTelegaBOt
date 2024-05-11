const express = require("express");
const WebSocket = require("ws");
const { connection } = require("./module/conectionDb");

const app = express();
const PORT = 3000;

app.use(express.json());

let data = [];
let clients = [];

const initializeData = async () => {
  await syncData();
  setInterval(syncData, 600000);
};

const syncData = async () => {
  // const sql = 'SELECT * FROM [1_JSON_CONSUMER_INFO]'
  const sql = "SELECT * FROM [1_PAY]";

  try {
    const newData = await connection.query(sql);
    data = newData;
    console.log("Данные успешно обновлены.");

    // Отправляем обновленные данные всем подключенным клиентам
    broadcastData();
  } catch (error) {
    console.error("Ошибка при обновлении данных:", error);
  }
};

const broadcastData = () => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

initializeData();

app.get("/data", (req, res) => {
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: "Not Found" });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Создаем WebSocket-сервер на основе HTTP-сервера Express
const wss = new WebSocket.Server({ noServer: true });

// Обработчик подключения клиента к WebSocket-серверу
wss.on("connection", (ws) => {
  clients.push(ws);

  // Отправляем текущие данные клиенту при подключении
  ws.send(JSON.stringify(data));

  // Обработчик закрытия соединения клиента
  ws.on("close", () => {
    clients = clients.filter((client) => client !== ws);
  });
});

// Добавляем WebSocket-сервер к HTTP-серверу Express
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
