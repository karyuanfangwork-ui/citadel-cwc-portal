import puppeteer from 'puppeteer-core';

const CHROME_PATHS = [
  process.env.CHROME_PATH,            // explicit override (e.g. in Docker)
  '/usr/bin/chromium',                 // Debian/Ubuntu package
  '/usr/bin/chromium-browser',         // older Ubuntu
  '/usr/bin/google-chrome',            // Google Chrome on Linux
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',    // Windows
].filter(Boolean) as string[];

async function findChrome(): Promise<string> {
  const fs = await import('fs');
  for (const p of CHROME_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* skip inaccessible paths */ }
  }
  throw new Error(
    `Chrome/Chromium not found. Searched: ${CHROME_PATHS.join(', ')}. ` +
    'Install Chromium or set the CHROME_PATH env var.',
  );
}

/**
 * Chrome/Chromium launch args for headless PDF generation inside Docker containers.
 *
 * Chromium 150+ crashes (SIGTRAP / exit code 133) in minimal containers because:
 *  - No D-Bus daemon → harmless warnings logged to stderr
 *  - The new headless mode (--headless=new, which is the default since Chrome 112)
 *    can fail to launch in containers without a display compositor.
 *
 * The fix is to use the *old* headless mode (`--headless=old`) combined with
 * `--disable-gpu`, `--disable-software-rasterizer`, and `--disable-dev-shm-usage`.
 */
const DOCKER_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--no-first-run',
  '--headless=old',
] as const;

export async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await findChrome();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [...DOCKER_CHROME_ARGS],
    env: {
      ...process.env,
      // Prevent Chromium from trying to autolaunch D-Bus in the container
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/dev/null',
    },
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}