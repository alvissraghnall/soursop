import puppeteer from "puppeteer-core";

(async () => {
  const url =
    "https://www.dextools.io/app/en/solana/pair-explorer/Cxk1qpQFdmWYMWVwWmR5AaREjBatZRrGwGWrxErKccTk";

  const width = 1450;
  const height = 1200;
  let browser = null; // Define browser outside the try block to access it in finally

  try {
    browser = await puppeteer.launch({
      browser: "firefox",
      executablePath: "/data/data/com.termux/files/usr/bin/firefox",
      headless: true,
      args: [`--width=${width}`, `--height=${height}`],
    });

    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(60000); // 60 seconds

    await page.goto(url, { waitUntil: "networkidle2" });

    console.log("AGLR");

    const tokenLeftSelector = "app-token-name .token-left";
    const tokenRightSelector = "app-token-name .token-right";

    await page.waitForSelector(tokenLeftSelector, { timeout: 30000 }); // Wait for up to 30s
    await page.waitForSelector(tokenRightSelector, { timeout: 30000 });

    const tokenPair = await page.evaluate(
      (leftSelector, rightSelector) => {
        const tokenLeft = document
          .querySelector(leftSelector)
          ?.textContent?.trim();
        const tokenRight = document
          .querySelector(rightSelector)
          ?.textContent?.trim();
        return { tokenLeft, tokenRight };
      },
      tokenLeftSelector,
      tokenRightSelector,
    );

    if (tokenPair.tokenLeft && tokenPair.tokenRight) {
      console.log(`Token: ${tokenPair.tokenLeft} / ${tokenPair.tokenRight}`);
    } else {
      console.error("Could not find one or both of the token names.");
    }
  } catch (error) {
    console.error("An error occurred during scraping:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
