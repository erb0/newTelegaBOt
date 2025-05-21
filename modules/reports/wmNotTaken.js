const fs = require("fs");
const path = require("path");
const fontkit = require("@pdf-lib/fontkit");
const { PDFDocument, rgb } = require("pdf-lib");
const { locationCodes } = require("../accessDb");
const { formatDate } = require("../plugin");

async function wmNotTaken(value, ctx, connection) {
  let pdfFilePath;

  try {
    const query = `
    SELECT
      conscode,
      consname,
      street,
      house,
      newDebt
    FROM [1_WCOUNT_5_YEAR]
    WHERE locationCode = '${value}'
    ORDER BY street,house
    `;

    await ctx.reply("Ждите, идет запрос в базу...");

    const data = await connection.query(query);

    if (data && data.length > 0) {
      const locationName = locationCodes[value]; // Убедитесь, что locationCodes определен
      if (!locationName) {
        await ctx.reply(`Неизвестный код местоположения: ${value}`);
        return;
      }

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const fontBytes = fs.readFileSync(
        path.resolve(__dirname, "../fonts/Roboto-Regular.ttf")
      );
      const font = await pdfDoc.embedFont(fontBytes);
      const fontSize = 14;
      const lineHeight = 14;
      let page = pdfDoc.addPage([600, 800]);
      let y = 750;

      // Заголовок
      page.drawText(locationName, {
        x: 50,
        y,
        size: fontSize + 4,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight * 2;

      // Заголовки столбцов
      page.drawText("Лсчет", {
        x: 20,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText("ФИО", {
        x: 90,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText("Улица", {
        x: 290,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText("Номер", {
        x: 490,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText("Долг", {
        x: 540,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;

      let totalSumDebt = 0;
      let totalCount = 0;

      for (const row of data) {
        const { conscode, consname, street, house, newDebt } = row;
        if (isNaN(newDebt)) continue; // Пропускаем некорректные данные
        totalCount += 1;
        totalSumDebt += parseFloat(newDebt);

        page.drawText(conscode.toString(), {
          x: 20,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText(consname ? consname.toString() : "", {
          x: 90,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText(street.toString(), {
          x: 290,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText(house ? house.toString() : "", {
          x: 490,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText(newDebt.toFixed(0).toString(), {
          x: 540,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 4;
        page.drawLine({
          start: { x: 20, y },
          end: { x: 580, y },
          thickness: 1,
          color: rgb(0.75, 0.75, 0.75),
        });
        y -= lineHeight;

        if (y < 50) {
          y = 750;
          page = pdfDoc.addPage([600, 800]);
        }
      }

      if (totalSumDebt > 0) {
        y -= lineHeight;
        page.drawText("Сумма:", {
          x: 20,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText(totalSumDebt.toFixed(0).toString(), {
          x: 120,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
        page.drawText("Количество:", {
          x: 20,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText(totalCount.toString(), {
          x: 120,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const currentDateTime = new Date();
      const formattedDateTime = formatDate(currentDateTime);
      pdfFilePath = `${locationName} - ${formattedDateTime}.pdf`;

      fs.writeFileSync(pdfFilePath, pdfBytes);

      await ctx.reply("Идет формирование отчета...");

      // Используем поток для отправки документа
      const stream = fs.createReadStream(pdfFilePath);
      await ctx.replyWithDocument({ source: stream, filename: pdfFilePath });

      // Удаление временного файла
      if (pdfFilePath && fs.existsSync(pdfFilePath)) {
        fs.unlinkSync(pdfFilePath);
      }
    } else {
      await ctx.reply(`Нет результатов для ${value}`);
    }
  } catch (error) {
    console.error(error);
    await ctx.reply("Произошла ошибка при выполнении запроса.");
  } finally {
    // Дополнительное удаление файла в случае ошибки
    if (pdfFilePath && fs.existsSync(pdfFilePath)) {
      fs.unlinkSync(pdfFilePath);
    }
  }
}

module.exports = {
  wmNotTaken,
};
