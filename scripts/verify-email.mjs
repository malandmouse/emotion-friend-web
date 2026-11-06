import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'

const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright')
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5176'
await mkdir(new URL('../tmp/verification/', import.meta.url), { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
const verificationId = randomUUID()
const token = 'synthetic_verification_token_'.padEnd(43, 'x')
const storageKey = 'emotion-friend.email-verification.v1'
const results = []

async function context() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const model = { confirms: 0, verified: false, mode: 'ok', loginCount: 0 }
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname
    const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(body) })
    if (path.endsWith('/auth/login') || path.endsWith('/auth/refresh')) {
      model.loginCount += 1
      return reply(200, { credential: { accessToken: 'synthetic-access', expiresAt: new Date(Date.now() + 600_000).toISOString() }, refreshToken: `synthetic-refresh-${model.loginCount}` })
    }
    if (path.endsWith('/me')) return reply(200, { id: 'f97c9b03-fdce-41d3-8ab6-ceb554ee6dc4', email: 'verification@example.test', displayName: '메일 확인 테스트', role: null, requestedRole: 'GUARDIAN', status: 'PENDING', emailVerified: model.verified, createdAt: new Date().toISOString() })
    if (path.endsWith('/auth/email-verifications/confirm')) {
      model.confirms += 1
      assert.deepEqual(request.postDataJSON(), { verificationId, token })
      assert.equal(request.headers().authorization, 'Bearer synthetic-access')
      if (model.mode === 'invalid') return reply(422, { code: 'VERIFICATION_INVALID' })
      model.verified = true; return reply(204)
    }
    if (path.endsWith('/auth/email-verifications')) return reply(202, { message: 'accepted' })
    if (path.endsWith('/auth/logout')) return reply(204)
    throw new Error(`Unexpected fixture path ${path}`)
  })
  return { context, model, page: await context.newPage() }
}
async function signin(page) {
  await page.getByLabel('이메일 주소').fill('verification@example.test')
  await page.getByLabel('비밀번호').fill('Synthetic password for email test!')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.getByRole('heading', { name: '이메일 확인', exact: true }).waitFor()
  await page.getByRole('button', { name: '이메일 확인 완료', exact: true }).waitFor()
}
async function check(name, run) { await run(); results.push(name); console.log(`PASS ${name}`) }
const link = `${base}/#/verify-email?verificationId=${verificationId}&token=${token}`
try {
  await check('fragment secret is removed before login, retained across reload and used only after an explicit click', async () => {
    const { context: c, model, page } = await context()
    await page.goto(link); await page.getByRole('link', { name: '로그인하고 계속하기' }).waitFor()
    assert.equal(page.url(), `${base}/#/verify-email`)
    assert.equal(model.confirms, 0)
    assert.equal(await page.evaluate(() => localStorage.getItem('emotion-friend.email-verification.v1')), null)
    await page.reload(); await page.getByRole('link', { name: '로그인하고 계속하기' }).click(); await signin(page)
    assert.equal(model.confirms, 0)
    await page.getByRole('button', { name: '이메일 확인 완료', exact: true }).click()
    await page.getByText('이메일 확인을 완료했어요', { exact: true }).waitFor()
    assert.equal(model.confirms, 1)
    assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), storageKey), null)
    await page.screenshot({ path: new URL('../tmp/verification/email-confirmed.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true })
    await c.close()
  })
  await check('invalid or wrong-account confirmation offers recovery without exposing its token', async () => {
    const { context: c, model, page } = await context(); model.mode = 'invalid'
    await page.goto(link); await page.getByRole('link', { name: '로그인하고 계속하기' }).click(); await signin(page)
    await page.getByRole('button', { name: '이메일 확인 완료', exact: true }).click()
    await page.getByText(/확인 정보가 만료되었거나 이미 사용되었어요/).waitFor()
    assert.equal(model.confirms, 1); assert.equal((await page.locator('body').innerText()).includes(token), false)
    await page.getByRole('button', { name: '다른 계정으로 로그인' }).click()
    await page.getByRole('heading', { name: '보호자·치료사 로그인', exact: true }).waitFor()
    model.mode = 'ok'; await signin(page)
    await page.getByRole('button', { name: '이메일 확인 완료', exact: true }).click(); await page.getByText('이메일 확인을 완료했어요', { exact: true }).waitFor()
    await c.close()
  })
  await check('malformed and duplicate-parameter links are rejected without confirmation requests', async () => {
    for (const suffix of ['verificationId=bad&token=bad', `verificationId=${verificationId}&token=${token}&token=${token}`]) {
      const { context: c, model, page } = await context(); await page.goto(`${base}/#/verify-email?${suffix}`)
      await page.getByText('사용할 확인 링크가 없어요', { exact: true }).waitFor(); assert.equal(model.confirms, 0)
      assert.equal(page.url(), `${base}/#/verify-email`); await c.close()
    }
  })
  await check('same-document mail link navigation is captured and memory-only storage still supports login', async () => {
    const { context: c, model, page } = await context()
    await c.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'emotion-friend.email-verification.v1') throw new DOMException('Disabled'); return original.call(this, key, value) } })
    await page.goto(`${base}/#/overview`)
    await page.evaluate((hash) => { location.hash = hash }, `#/verify-email?verificationId=${verificationId}&token=${token}`)
    await page.getByRole('link', { name: '로그인하고 계속하기' }).click(); await signin(page)
    assert.equal(model.confirms, 0)
    await page.getByRole('button', { name: '이메일 확인 완료', exact: true }).click(); await page.getByText('이메일 확인을 완료했어요', { exact: true }).waitFor()
    await c.close()
  })
  console.log(`Email browser verification: ${results.length} scenarios passed.`)
  await writeFile(new URL('../tmp/verification/email-verification.json', import.meta.url), JSON.stringify({ status: 'PASS', scenarios: results }, null, 2))
} finally { await browser.close() }
