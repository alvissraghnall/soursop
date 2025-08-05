import puppeteer from 'puppeteer';

(async () => {
  const url = 'https://www.dextools.io/app/en/solana/pair-explorer/Cxk1qpQFdmWYMWVwWmR5AaREjBatZRrGwGWrxErKccTk?t=1754395133372';

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  const tokenLeftLocator = await page.waitForSelector('span.token-left');
  const tokenRightLocator = await page.waitForSelector('span.token-right');

  const tokenLeft = await tokenLeftLocator?.evaluate(el => el.textContent);
  const tokenRight = await tokenRightLocator?.evaluate(el => el.textContent);

  console.log(`Token: ${tokenLeft?.trim()} / ${tokenRight?.trim()}`);

  await browser.close();
})();
