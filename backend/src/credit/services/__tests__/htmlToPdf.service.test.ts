import fs from 'fs';
import puppeteer from 'puppeteer';
import { findChrome, htmlToPdf } from '../htmlToPdf.service';

const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('htmlToPdf.service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('falls back to Puppeteer bundled Chrome when system Chromium is unavailable', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => String(path) === '/tmp/mock-chrome');

    await expect(findChrome()).resolves.toBe('/tmp/mock-chrome');
    expect(mockedPuppeteer.executablePath).toHaveBeenCalled();
  });

  it('launches bundled Chrome without forcing deprecated old headless mode', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => String(path) === '/tmp/mock-chrome');
    const close = jest.fn().mockResolvedValue(undefined);
    const pdf = jest.fn().mockResolvedValue(Buffer.from('pdf'));
    const setContent = jest.fn().mockResolvedValue(undefined);
    mockedPuppeteer.launch.mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({ setContent, pdf }),
      close,
    } as any);

    const result = await htmlToPdf('<html><body>ok</body></html>');

    expect(result.toString()).toBe('pdf');
    expect(mockedPuppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({
      executablePath: '/tmp/mock-chrome',
      headless: true,
      args: expect.arrayContaining(['--single-process']),
    }));
    expect(mockedPuppeteer.launch.mock.calls[0][0]?.args).not.toContain('--headless=old');
    expect(close).toHaveBeenCalled();
  });
});
