import fs from 'fs';
import puppeteer from 'puppeteer';

const CHROME_PATHS = [
  process.env.CHROME_PATH,            // explicit override (e.g. in Docker)
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/chromium',                 // Debian/Ubuntu package
  '/usr/bin/chromium-browser',         // older Ubuntu
  '/usr/bin/google-chrome',            // Google Chrome on Linux
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',    // Windows
].filter(Boolean) as string[];

export async function findChrome(): Promise<string> {
  for (const p of CHROME_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* skip inaccessible paths */ }
  }
  const bundledPath = await puppeteer.executablePath();
  if (bundledPath && fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  throw new Error(
    `Chrome/Chromium not found. Searched: ${CHROME_PATHS.join(', ')}, ${bundledPath}. ` +
    'Install the Puppeteer browser cache or set CHROME_PATH/PUPPETEER_EXECUTABLE_PATH.',
  );
}

/**
 * Chrome/Chromium launch args for headless PDF generation inside Docker containers.
 *
 * Production uses Puppeteer's pinned Chrome for Testing binary instead of the
 * distro `chromium` package. The distro package has crashed in Docker with
 * SIGTRAP while probing Linux CPU frequency sysfs paths.
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
  '--single-process',
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