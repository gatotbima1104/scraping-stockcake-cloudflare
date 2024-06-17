import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { setTimeout } from "timers/promises";
import ExcelJS from "exceljs";

puppeteer.use(StealthPlugin());

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();

    const categories = {
      edukasi: 'https://www.detik.com/edu/indeks/',
      finance: 'https://finance.detik.com/indeks/',
      hot: 'https://hot.detik.com/indeks/',
      sport: 'https://sport.detik.com/indeks/',
      news: 'https://news.detik.com/indeks/',
    }

    const numberOfPages = 10; // Set the number of pages you want to scrape

    // Function to filter links based on category URL
    const filterLinks = (links, categoryUrl) => {
      if (categoryUrl.includes("https://news.detik.com")) {
        return links.filter(url => url.includes("https://news.detik.com/berita"));
      } else if (categoryUrl.includes("https://hot.detik.com")) {
        return links.filter(url => url.includes("https://hot.detik.com"));
      } else if (categoryUrl.includes("https://www.detik.com/edu/")) {
        return links.filter(url => url.includes("https://www.detik.com/edu/"));
      } else {
        return links;
      }
    };

    const navigationTimeout = 60000; // Set your desired navigation timeout in milliseconds

    // Function to handle navigation with retries
    const navigateWithRetry = async (page, url, options) => {
      let retries = 3; // Set the number of retries
      while (retries > 0) {
        try {
          await page.goto(url, options);
          return; // Navigation succeeded, exit the loop
        } catch (error) {
          if (error instanceof puppeteer.errors.TimeoutError) {
            console.log(`Navigation to ${url} timed out. Retrying...`);
            retries--;
          } else {
            throw error; // Throw if it's not a timeout error
          }
        }
      }
      throw new Error(`Failed to navigate to ${url} after multiple retries.`);
    };

    // Loop through each category
    for (const category in categories) {
      if (categories.hasOwnProperty(category)) {
        console.log(`Scraping ${category}...`);
        const categoryUrl = categories[category];
        let articles = [];
        for (let i = 1; i <= numberOfPages; i++) {
          await page.goto(`${categoryUrl}${i}`, { waitUntil: 'domcontentloaded' });
          await setTimeout(500);
  
          const pageData = await page.evaluate(() => {
            // Extract href attributes from anchor elements with class 'media__link'
            const links = Array.from(document.querySelectorAll("a.media__link"));
            const hrefs = links.map(link => link.getAttribute('href'));
  
            // Remove duplicates using Set
            const uniqueHrefs = [...new Set(hrefs)];
  
            // Remove the first and last elements
            const trimmedHrefs = uniqueHrefs.slice(1, -1);
  
            return trimmedHrefs;
          });

          // Filter links based on category URL
          const filteredLinks = filterLinks(pageData, categoryUrl);
  
          // Extract articles data
          for (let link of filteredLinks) {
            await navigateWithRetry(page, link, { waitUntil: 'domcontentloaded', timeout: navigationTimeout });
            // await page.goto(link, { waitUntil: 'domcontentloaded' });
            await setTimeout(500);
  
            // Extract the title, time, and content
            const article = await page.evaluate(() => {
              const title = document.querySelector('h1.detail__title') ? document.querySelector('h1.detail__title').innerText : null;
              const time = document.querySelector('.detail__date') ? document.querySelector('.detail__date').innerText : null;
              const content = document.querySelector('.detail__body-text') ? document.querySelector('.detail__body-text').innerText.replace(/\n/g, ' ') : null;
  
              return { title, time, content };
            });

            console.log(article)
  
            // Push article with category information
            articles.push({ link, title: article.title, time: article.time, category, content: article.content });
            await setTimeout(1000); // Wait for 2 seconds before navigating to the next page
          }
        }
        
        // Create a new workbook for each category
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Articles');
  
        // Define headers
        worksheet.addRow(['Link', 'Title', 'Time', 'Category', 'Content']);
  
        // Add data rows
        articles.forEach(article => {
          worksheet.addRow([article.link, article.title, article.time, article.category, article.content]);
        });
  
        // Save workbook to a file
        await workbook.xlsx.writeFile(`${category}_articles.xlsx`);
  
        console.log(`${category} articles saved to ${category}_articles.xlsx`);
      }
    }

    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();
