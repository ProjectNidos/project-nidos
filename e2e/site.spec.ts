import { test, expect } from '@playwright/test';

test('Latvian home shows the four services and sets no cookies', async ({ page, context }) => {
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toContain("'strict-dynamic'");
  await expect(page.locator('html')).toHaveAttribute('lang', 'lv');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Digitalizējam uzņēmumus. Skaidri un droši.');
  for (const name of ['Google veikals', 'MI risinājumi', 'Digitalizācija atbilstoši ES regulējumam', 'Atbalsts un uzturēšana']) {
    await expect(page.getByRole('tab', { name }).first()).toBeVisible();
  }
  expect(await context.cookies()).toEqual([]);
});

test('opening a service and asking about it preselects it in the form (scripts run under the CSP)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'MI risinājumi' }).click();
  await expect(page.getByRole('tab', { name: 'MI risinājumi', selected: true })).toBeVisible();
  await page.getByRole('link', { name: 'Jautāt par šo' }).click();
  await expect(page.locator('#service')).toHaveValue('ai');
});

test('the services run from first to last without looping', async ({ page }) => {
  await page.goto('/');
  const previous = page.getByRole('button', { name: 'Iepriekšējais pakalpojums' });
  const next = page.getByRole('button', { name: 'Nākamais pakalpojums' });
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(previous).toBeDisabled();
  for (let i = 0; i < 3; i++) await next.click();
  await expect(page.getByRole('tab', { name: 'Atbalsts un uzturēšana', selected: true })).toBeVisible();
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(page.getByRole('tab', { name: 'Digitalizācija atbilstoši ES regulējumam', selected: true })).toBeVisible();
});

test('the technologies strip names every logo', async ({ page }) => {
  await page.goto('/');
  const strip = page.getByRole('region', { name: 'Tehnoloģijas, ar kurām strādājam.' });
  await expect(strip.getByRole('listitem')).toHaveCount(13);
  await expect(strip.getByText('Supabase')).toBeVisible();
});

test('switching to English keeps the page', async ({ page }) => {
  await page.goto('/privatuma-politika');
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
});

test('the contact form explains what is missing', async ({ page }) => {
  await page.goto('/en');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Please fill in this field.').first()).toBeVisible();
  // What the visitor typed survives the error.
  await expect(page.getByLabel('Email')).toHaveValue('not-an-email');
});

test('when the database is unreachable the form says so and keeps the text', async ({ page }) => {
  await page.goto('/en');
  await page.getByLabel('Name', { exact: true }).fill('Anna');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.locator('#service').selectOption('ai');
  await page.getByLabel('Message').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Sending failed/)).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue('Hello');
});

test('unknown pages are 404 in the right language', async ({ page }) => {
  const res = await page.goto('/en/nope');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test('admin needs a sign-in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('button', { name: 'Ienākt' })).toBeVisible();
});
