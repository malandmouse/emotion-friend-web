import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright')
const baseUrl = process.env.UI_BASE_URL || 'http://127.0.0.1:5173'
const output = new URL('../tmp/verification/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await playwright.chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } })
const errors = []
const externalRequests = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => {
  if (!request.url().startsWith(baseUrl) && !request.url().startsWith('data:')) externalRequests.push(request.url())
})
const checks = []
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`) }
async function open(route) { await page.goto(`${baseUrl}/#/${route}`); await page.locator('h1').waitFor(); await page.evaluate(() => document.fonts.ready) }

try {
  await check('Desktop layout and overview', async () => {
    await open('overview')
    assert.equal(await page.locator('html').getAttribute('lang'), 'ko')
    assert.equal(await page.locator('a[aria-current="page"]').first().textContent(), '개요')
    assert.equal(await page.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().width), 240)
    assert.equal(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontWeight), '700')
    await page.getByRole('heading', { name: '별이의 오늘' }).waitFor()
    await page.screenshot({ path: new URL('overview-1440.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
  })
  await check('Required profile fields, focus, busy state and preview result', async () => {
    await open('profile')
    await page.getByLabel('아동 가명').fill('')
    await page.getByLabel('학습 아동 성별').selectOption('')
    await page.getByRole('button', { name: '프로필 저장' }).click()
    assert.equal(await page.locator('#child-name').getAttribute('aria-invalid'), 'true')
    assert.equal(await page.locator('#child-gender').getAttribute('aria-invalid'), 'true')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'child-name')
    const descriptionIds = (await page.locator('#child-name').getAttribute('aria-describedby')).split(' ')
    for (const id of descriptionIds) assert.equal(await page.locator(`[id="${id}"]`).count(), 1)
    await page.screenshot({ path: new URL('profile-error-1440.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
    await page.getByLabel('아동 가명').fill('별이')
    await page.getByLabel('학습 아동 성별').selectOption('female')
    await page.getByRole('button', { name: '프로필 저장' }).click()
    assert.equal(await page.getByRole('button', { name: '입력 확인 중' }).isDisabled(), true)
    assert.equal(await page.getByLabel('아동 가명').isDisabled(), true)
    await page.getByText('입력 확인을 마쳤어요').waitFor()
    assert.equal(await page.getByLabel('아동 가명').isEnabled(), true)
    await page.getByLabel('아동 가명').fill('달이')
    assert.equal(await page.getByText('입력 확인을 마쳤어요').count(), 0)
  })
  await check('Auth validation, rejected API login and signup transition (mock response)', async () => {
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'AUTH_REQUIRED' }) }))
    await open('login')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    assert.equal(await page.getByLabel('이메일 주소').getAttribute('aria-invalid'), 'true')
    await page.getByLabel('이메일 주소').fill('invalid')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await page.getByText('올바른 이메일 주소를 입력해 주세요.').waitFor()
    await page.getByLabel('이메일 주소').fill('preview@example.test')
    await page.getByLabel('비밀번호').fill('preview-only')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await page.getByText('이메일 주소 또는 비밀번호를 확인해 주세요.').waitFor()
    assert.ok(page.url().endsWith('#/login'))
    await page.screenshot({ path: new URL('login-1440.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
    await page.getByRole('link', { name: '회원가입', exact: true }).click()
    await page.getByLabel('이름', { exact: false }).waitFor()
    assert.equal(await page.getByLabel('이메일 주소').inputValue(), '')
    await page.getByRole('button', { name: '계정 만들기' }).click()
    assert.equal(await page.locator('[aria-invalid=true]').count(), 3)
  })
  await check('Button busy guard, error retry, input states and reduced motion', async () => {
    await open('components')
    await page.getByRole('button', { name: '동작 확인', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '확인 중', exact: true }).isDisabled(), true)
    await page.getByText('미리보기 동작을 마쳤어요.', { exact: false }).waitFor()
    await page.getByRole('button', { name: '다시 시도', exact: true }).click()
    await page.getByText('재시도 미리보기를 마쳤어요.').waitFor()
    await page.getByRole('button', { name: '오류 상태 다시 보기' }).click()
    await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor()
    assert.equal(await page.getByLabel('읽기 전용').getAttribute('readonly'), '')
    assert.equal(await page.getByLabel('비활성 입력').isDisabled(), true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.ok(await page.locator('.spinner').first().evaluate((e) => parseFloat(getComputedStyle(e).animationDuration) < 0.01))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.screenshot({ path: new URL('components-1440.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
  })
  await check('834px tablet menu, single column, and no overflow at 1440 / 834 / 390 / 320', async () => {
    for (const width of [1440, 834, 390, 320]) {
      await page.setViewportSize({ width, height: 1112 })
      for (const route of ['overview', 'profile', 'components', 'login', 'signup']) {
        await open(route)
        const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
        assert.ok(dimensions.scroll <= dimensions.width, `${route} at ${width}: ${JSON.stringify(dimensions)}`)
        if (width === 834 && route === 'profile') assert.equal(await page.locator('.form-grid').first().evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1)
        if (width === 834 && route === 'overview') {
          assert.equal(await page.locator('.sidebar').evaluate((e) => getComputedStyle(e).position), 'sticky')
          await page.screenshot({ path: new URL('overview-834.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
        }
        if (width === 390 && route === 'overview') await page.screenshot({ path: new URL('overview-390.png', output).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true })
      }
    }
  })
  await check('Keyboard skip link and navigation', async () => {
    await open('overview')
    await page.locator('body').click({ position: { x: 2, y: 2 } })
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('Tab')
    // Focus the skip link explicitly to avoid browser-specific starting focus after a click.
    await page.locator('.skip-link').focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content')
    await page.getByRole('link', { name: '아동 프로필', exact: true }).click()
    await page.getByRole('heading', { name: '별이의 프로필' }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content')
    await page.getByRole('link', { name: '학습 기록', exact: true }).click()
    await page.getByRole('heading', { name: '관리할 아동을 선택해 주세요' }).waitFor()
    await page.goBack()
    await page.getByRole('heading', { name: '별이의 프로필' }).waitFor()
    await open('unknown')
    await page.getByRole('heading', { name: '페이지를 찾을 수 없어요' }).waitFor()
  })
  assert.deepEqual(errors, [], 'Unexpected browser errors')
  assert.deepEqual(externalRequests, [], 'The preview must not transmit data externally')
  await writeFile(new URL('result.json', output), JSON.stringify({ passed: checks, browserErrors: errors, externalRequests, baseUrl }, null, 2))
  console.log(`Completed ${checks.length} verification groups.`)
} finally { await browser.close() }
