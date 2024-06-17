//// STOCKCAKE
// Function to scrape links from given pages
export async function getLinks(page, pageValue, maxPageValue) {
    let firstPage = pageValue;
    let maxPage = maxPageValue;
    let result = [];

    for (let i = firstPage; i <= maxPage; i++) {
      console.log(`Scraping page ${i}...`);
      const page = await browser.newPage();
      const url = `https://stockcake.com/s/technology/${i}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await setTimeout(2000);

      const pageData = await page.evaluate(() => {
        const urlElement = document.querySelectorAll("a.group");
        const urls = Array.from(urlElement).map(
          (url) => "https://stockcake.com/" + url.getAttribute("href")
        );

        return urls;
      });

      result.push(...pageData);
      await page.close();
    }

    return result;
  }