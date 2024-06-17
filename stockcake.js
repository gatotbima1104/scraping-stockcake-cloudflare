import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { setTimeout } from "node:timers/promises";
import ExcelJS from "exceljs";
import { connect } from "puppeteer-real-browser";

// Using the stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Connecting with puppeteer-real-browser
connect({
  headless: "auto",
  turnstile: true,
}).then(async (response) => {
  const { page, browser, setTarget } = response;

  // Function to read data from an Excel file
  async function readExcelFile(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // get the first worksheet

    let data = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip the first row
        const url = row.values[1];
        if (
          url &&
          typeof url === "string" &&
          url.startsWith("https://stockcake.com")
        ) {
          data.push(url);
        }
      }
    });

    return data;
  }

  // Function to save data to Excel
  async function saveToExcel(data, filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Extracted Data");

      // Add headers
      worksheet.addRow(["URL", "Title", "Prompt", "Keywords"]);

      // Add data rows
      data.forEach((item) => {
        worksheet.addRow([item.url, item.title, item.prompt, item.keywords]);
      });

      // Save workbook
      await workbook.xlsx.writeFile(filePath);
    } catch (error) {
      console.log("Error saving Excel:", error);
    }
  }

  // Function to retry page.goto
  async function retry(fn, retries = 3) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        console.log(`Retry ${4 - retries} due to error:`, error);
        await setTimeout(3000); // Wait before retrying
        return retry(fn, retries - 1);
      } else {
        throw new Error("Max retries exceeded. Unable to proceed.");
      }
    }
  }

  // Main IIFE for script execution
  (async () => {
    try {
      const data = await readExcelFile("./stock-cake-urls3.xlsx");
      const extractedData = [];

      for (let item of data) {
        let articleData;
        try {
          // Retry page.goto up to 3 times
          await retry(async () => {
            await page.goto(item, { waitUntil: "domcontentloaded" });
          });

          await setTarget({ status: false });

          let page2 = await browser.newPage();
          await setTarget({ status: true });
          await setTimeout(4000);

          // Remove the hidden class from the selected element
          await page.evaluate(() => {
            const element = document.querySelector("span.hidden");
            if (element) {
              element.classList.remove("hidden");
            }
          });

          articleData = await page.evaluate(() => {
            const titleElement = document.querySelector("h1");
            const promptElement = document.querySelector("p.text-sm");
            const keywordsElement = document.querySelectorAll(
              "a.button_tag_search"
            );
            const url = window.location.href;

            const title = titleElement ? titleElement.textContent.trim() : null;
            const keywords = Array.from(keywordsElement)
              .map((el) => el.textContent.trim().replace(/\n/g, " "))
              .join(", ");
            const prompt = promptElement
              ? promptElement.textContent.trim()
              : null;

            return {
              url,
              title,
              prompt,
              keywords,
            };
          });

          console.log(articleData)

          await page2.close();
        } catch (error) {
          console.log(`Error processing ${item}:`, error);
          continue; // Skip to the next item on error
        }

        extractedData.push(articleData);
      }

      await browser.close();

      // Save to Excel
      await saveToExcel(extractedData, "stock-cake-extracted-data.xlsx");
      console.log("Data successfully saved to stock-cake-extracted-data.xlsx");
    } catch (error) {
      console.log(error);
    }
  })();
});
