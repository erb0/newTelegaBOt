async function exportMongoLogsToExcel(Log) {
  try {
    const logs = await Log.find().lean(); // Получаем все логи
    if (logs.length === 0) {
      console.log("Нет логов для экспорта.");
      return;
    }

    const headers = ["Chat ID", "Name", "Type", "Data", "Timestamp"];
    const rows = logs.map((log) => [
      log.chatId,
      log.name,
      log.type,
      log.data,
      log.timestamp.toLocaleString("ru-RU"),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MongoLogs");

    const exportPath = path.join(__dirname, "log", "mongo_logs_export.xlsx");
    XLSX.writeFile(workbook, exportPath);
    console.log("MongoDB логи экспортированы в Excel:", exportPath);
  } catch (error) {
    console.error("Ошибка при экспорте логов из MongoDB:", error);
  }
}
