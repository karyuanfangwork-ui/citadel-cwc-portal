import { expect, test, type Page } from '@playwright/test';
import { STATE_FILES } from './support/auth';

async function openBorrowerList(page: Page) {
  await page.goto('/credit/borrowers', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Borrower Management' })).toBeVisible();
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test.describe('Credit Borrower List operational journey', () => {
  test.use({ storageState: STATE_FILES.analyst });

  test('opens Borrower Management and keeps search state in the URL', async ({ page }) => {
    await openBorrowerList(page);
    await expect(page.getByRole('region', { name: 'Borrower list heading' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Borrower summary metrics' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Borrower list' })).toBeVisible();
    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();
    await search.fill('Ahmad');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Ahmad');
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
    await expect(page.getByText(/borrowers$/i).first()).toBeVisible();
  });

  test('applies and clears borrower filters through the filter surface', async ({ page }) => {
    await openBorrowerList(page);

    await page.getByRole('button', { name: /^Filters/ }).click();
    const filters = page.getByRole('dialog', { name: 'Borrower filters' });
    await expect(filters).toBeVisible();
    await filters.getByRole('combobox', { name: 'Segment' }).selectOption('SME');
    await filters.getByRole('combobox', { name: 'Status' }).selectOption('ACTIVE');
    await expect(page).toHaveURL(/segment=SME/);
    await expect(page).toHaveURL(/status=ACTIVE/);
    await expect(page.getByRole('button', { name: /Filters \(2\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page).not.toHaveURL(/segment=SME|status=ACTIVE/);
    await expect(filters.getByRole('combobox', { name: 'Segment' })).toHaveValue('');
    await expect(filters.getByRole('combobox', { name: 'Status' })).toHaveValue('');
  });

  test('uses a row action to open Borrower 360 without a quick-preview overlay', async ({ page }) => {
    await openBorrowerList(page);
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow, 'No borrower rows. Run the demo credit seed.').toBeVisible({ timeout: 15_000 });

    const actions = firstRow.getByRole('button', { name: /^Actions for / });
    await actions.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: 'Open 360 View' }).click();

    await expect(page).toHaveURL(/\/credit\/borrowers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('keeps the desktop action menu dismissible', async ({ page }) => {
    await openBorrowerList(page);
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow, 'No borrower rows. Run the demo credit seed.').toBeVisible({ timeout: 15_000 });

    await firstRow.getByRole('button', { name: /^Actions for / }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

});

test.describe('Credit Borrower List mobile journey', () => {
  test.use({ storageState: STATE_FILES.analyst, viewport: { width: 390, height: 844 } });

  test('uses borrower cards without page overflow and supports details, actions, and 360 navigation', async ({ page }) => {
    await openBorrowerList(page);
    const cards = page.getByRole('region', { name: 'Borrower cards' });
    await expect(cards, 'No borrower cards. Run the demo credit seed.').toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('table', { name: 'Borrower list' })).toBeHidden();
    await expectNoHorizontalPageOverflow(page);

    const firstCard = cards.getByRole('article').first();
    await firstCard.getByRole('button', { name: 'Show borrower details' }).click();
    await expect(firstCard.getByText('NRIC / Registration No.')).toBeVisible();

    const actionButton = firstCard.getByRole('button', { name: /^Actions for / });
    await actionButton.click();
    await expect(firstCard.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(firstCard.getByRole('menu')).toHaveCount(0);

    await firstCard.getByRole('button', { name: /Open .+ in Borrower 360/ }).click();
    await expect(page).toHaveURL(/\/credit\/borrowers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('keeps Create Borrower reachable on mobile', async ({ page }) => {
    await openBorrowerList(page);
    const create = page.getByRole('button', { name: 'Create Borrower' });
    await expect(create).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await create.click();
    await expect(page).toHaveURL('/credit/borrowers/new');
  });
});

test.describe('Credit Borrower List read-only journey', () => {
  test.use({ storageState: STATE_FILES.sodAnalyst });

  test('keeps the operational list available to a read-only credit user without create controls', async ({ page }) => {
    await page.goto('/credit/borrowers?segment=SME&status=ACTIVE');
    await expect(page.getByRole('heading', { name: 'Borrower Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Borrower/ })).toHaveCount(0);
    await expect(page).toHaveURL(/segment=SME/);
    await expect(page).toHaveURL(/status=ACTIVE/);
  });
});
