import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { STATE_FILES } from './support/auth';

const RAW_PIPELINE_STATES = /KYC_REVIEW|CREDIT_ASSESSMENT|COMMITTEE_REVIEW/;

async function selectManagerLane(page: Page) {
  const managerLane = page.getByRole('tab', { name: 'Portfolio' });
  await expect(managerLane).toBeVisible({ timeout: 15_000 });

  if (await managerLane.getAttribute('aria-selected') !== 'true') {
    await managerLane.click();
  }

  await expect(managerLane).toHaveAttribute('aria-selected', 'true');
}

async function assertNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    root: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(widths.body, `Body overflows the ${widths.viewport}px viewport`).toBeLessThanOrEqual(widths.viewport);
  expect(widths.root, `Document overflows the ${widths.viewport}px viewport`).toBeLessThanOrEqual(widths.viewport);
}

async function assertFooterFollowsManagerContent(page: Page) {
  const scrollOwner = page.locator('#main-content');
  await scrollOwner.evaluate(element => { element.scrollTop = element.scrollHeight; });

  const footer = page.locator('footer').last();
  await expect(footer).toBeInViewport();

  const positions = await page.evaluate(() => {
    const scrollOwner = document.querySelector<HTMLElement>('#main-content');
    const finalManagerSection = document.querySelector<HTMLElement>('[aria-labelledby="manager-activity-heading"]');
    const appFooter = document.querySelector<HTMLElement>('footer');
    if (!scrollOwner || !finalManagerSection || !appFooter) return null;

    const scrollOwnerBounds = scrollOwner.getBoundingClientRect();
    const finalSectionBounds = finalManagerSection.getBoundingClientRect();
    const footerBounds = appFooter.getBoundingClientRect();
    return {
      contentGap: scrollOwnerBounds.bottom - finalSectionBounds.bottom,
      footerOffset: footerBounds.top - scrollOwnerBounds.bottom,
      remainingScroll: scrollOwner.scrollHeight - scrollOwner.scrollTop - scrollOwner.clientHeight,
    };
  });

  expect(positions, 'The manager dashboard, scroll owner, and application footer should all be present.').not.toBeNull();
  expect(positions!.remainingScroll, 'The dashboard scroll owner should reach its bottom.').toBeLessThanOrEqual(1);
  expect(positions!.contentGap, 'The final dashboard section should not be hidden below the scroll owner.').toBeGreaterThanOrEqual(0);
  expect(positions!.contentGap, 'The dashboard should not leave a large blank region before the footer.').toBeLessThanOrEqual(128);
  expect(Math.abs(positions!.footerOffset), 'The footer should immediately follow the dashboard scroll owner.').toBeLessThanOrEqual(1);
}

async function assertManagerDashboard(page: Page, testInfo: TestInfo, screenshotName: string) {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/credit', { waitUntil: 'domcontentloaded' });
  await selectManagerLane(page);

  const pipelineHeading = page.getByRole('heading', { name: 'Application pipeline' });
  await expect(pipelineHeading).toHaveCount(1);
  await expect(page.getByText('Verification', { exact: true })).toBeVisible();
  await expect(page.getByText('Assessment', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(RAW_PIPELINE_STATES);

  await assertNoHorizontalOverflow(page);
  await assertFooterFollowsManagerContent(page);
  await page.screenshot({ path: testInfo.outputPath(screenshotName), fullPage: true });

  expect(pageErrors, `Manager dashboard raised: ${pageErrors.join(' | ')}`).toHaveLength(0);
}

test.describe('Credit dashboard role lanes', () => {
  test.describe('RM lane', () => {
    test.use({ storageState: STATE_FILES.analyst });

    test('shows the action-first work lane without Unknown borrower names', async ({ page }) => {
      await page.goto('/credit');
      await page.getByRole('tab', { name: 'My deals' }).click();
      await expect(page.getByRole('heading', { name: /Needs you/ })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Unknown')).toHaveCount(0);
      await expect(page).toHaveURL(/\/credit$/);
    });

    test('filters attention counts in place', async ({ page }) => {
      await page.goto('/credit');
      await page.getByRole('tab', { name: 'My deals' }).click();
      const returned = page.getByRole('button', { name: /^Returned:/ });
      await expect(returned).toBeVisible({ timeout: 10_000 });
      await returned.click();
      await expect(page.getByRole('heading', { name: /Needs you/ })).toBeVisible();
      await expect(page).toHaveURL(/\/credit$/);
    });
  });

  test.describe('approver lane', () => {
    test.use({ storageState: STATE_FILES.approver });

    test('can reach Decisions and expand a row without leaving the dashboard', async ({ page }) => {
      await page.goto('/credit');
      await expect(page.getByRole('tab', { name: 'Decisions' })).toBeVisible({ timeout: 10_000 });
      await page.getByRole('tab', { name: 'Decisions' }).click();
      await expect(page.getByRole('heading', { name: /decisions waiting/i })).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/\/credit$/);
    });

    test('persists the selected lane after reload', async ({ page }) => {
      await page.goto('/credit');
      await page.getByRole('tab', { name: 'My deals' }).click();
      await expect(page.getByRole('heading', { name: /Needs you/ })).toBeVisible({ timeout: 10_000 });
      await page.reload();
      await expect(page.getByRole('heading', { name: /Needs you/ })).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('manager lane', () => {
    test.use({ storageState: STATE_FILES.analyst });

    test('shows one readable pipeline without desktop overflow', async ({ page }, testInfo) => {
      await assertManagerDashboard(page, testInfo, 'credit-manager-dashboard-desktop.png');
    });

    test('keeps the manager dashboard readable at a 390px mobile width', async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await assertManagerDashboard(page, testInfo, 'credit-manager-dashboard-mobile.png');
    });
  });
});
