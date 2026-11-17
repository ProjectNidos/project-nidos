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
  await expect(strip.getByRole('list').getByText('Supabase')).toBeVisible();
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

// ── Admin live preview: the site framed by itself, driven by postMessage ─────
async function framedHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        addEventListener('message', (e) => {
          if (e.data?.tag === 'nidos-preview' && e.data.type === 'ready') resolve();
        });
        const f = document.createElement('iframe');
        f.id = 'pv';
        f.src = '/';
        f.style.cssText = 'width:100%;height:800px';
        document.body.append(f);
      }),
  );
  const send = (m: Record<string, string>) =>
    page.evaluate(
      (m) => (document.getElementById('pv') as HTMLIFrameElement).contentWindow!.postMessage({ tag: 'nidos-preview', ...m }, location.origin),
      m,
    );
  return { frame: page.frameLocator('#pv'), send };
}

test('preview: only our own site may frame the pages', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.headers()['x-frame-options']).toBe('SAMEORIGIN');
  expect(res?.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
});

test('preview: typed text replaces the page text, as plain text', async ({ page }) => {
  const { frame, send } = await framedHome(page);
  await send({ type: 'text', key: 'hero.title', value: '<b>Jauns virsraksts</b>' });
  await expect(frame.getByRole('heading', { level: 1 })).toHaveText('<b>Jauns virsraksts</b>');
  await expect(frame.locator('h1 b')).toHaveCount(0);
});

test('preview: focusing a service opens its panel', async ({ page }) => {
  const { frame, send } = await framedHome(page);
  await send({ type: 'focus', key: 'services.items.support.text' });
  await expect(frame.getByRole('tab', { name: 'Atbalsts un uzturēšana', selected: true })).toBeVisible();
});

test('preview: focusing the thank-you text shows it where the form is', async ({ page }) => {
  const { frame, send } = await framedHome(page);
  await send({ type: 'focus', key: 'contact.success' });
  await send({ type: 'text', key: 'contact.success', value: 'Paldies, drīz atbildēsim!' });
  await expect(frame.getByRole('status')).toHaveText('Paldies, drīz atbildēsim!');
  await send({ type: 'focus', key: 'contact.heading' });
  await expect(frame.locator('#service')).toBeVisible();
});

test('preview: a framed page sends no analytics', async ({ page }) => {
  const fromFrame: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/t') && r.frame() !== page.mainFrame()) fromFrame.push(r.url());
  });
  const { frame } = await framedHome(page);
  await expect(frame.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  expect(fromFrame).toEqual([]);
});

test('preview: admin pages may not be framed at all', async ({ page }) => {
  const res = await page.goto('/admin/login');
  expect(res?.headers()['x-frame-options']).toBe('DENY');
  expect(res?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});

test('preview: scrolling to a text moves only the preview, not the admin page', async ({ page }) => {
  const { frame, send } = await framedHome(page);
  await page.evaluate(() => scrollTo(0, 0));
  await send({ type: 'focus', key: 'contact.intro' });
  // The frame scrolls down to the contact section; the page around it stays put.
  await expect.poll(() => frame.locator('html').evaluate(() => scrollY)).toBeGreaterThan(1000);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('preview: navigating inside the preview says ready again', async ({ page }) => {
  const { frame } = await framedHome(page);
  const again = page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        addEventListener('message', (e) => {
          if (e.data?.tag === 'nidos-preview' && e.data.type === 'ready') resolve();
        }),
      ),
  );
  await frame.getByRole('link', { name: /privātuma politika/i }).first().click();
  await again;
});
