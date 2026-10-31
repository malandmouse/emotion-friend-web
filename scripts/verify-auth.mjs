import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'

const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright')
const baseUrl = process.env.UI_BASE_URL || 'http://127.0.0.1:5173'
const output = new URL('../tmp/verification/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
const results = []
const storageKey = 'emotion-friend.auth.v1'
const password = 'Synthetic auth password 12345!'
const member = { id: 'f97c9b03-fdce-41d3-8ab6-ceb554ee6dc4', email: 'auth-fixture@example.test', displayName: 'API 검증 치료사', requestedRole: 'THERAPIST', role: null, status: 'PENDING', emailVerified: false, createdAt: new Date().toISOString() }
async function check(name, run) { await run(); results.push(name); console.log(`PASS ${name}`) }
async function open(page, route) { await page.goto(`${baseUrl}/#/${route}`); await page.locator('h1').waitFor() }
async function fillLogin(page, remember = false, suppliedPassword = password) {
  await page.getByLabel('이메일 주소').fill(member.email)
  await page.getByLabel('비밀번호').fill(suppliedPassword)
  if (remember) await page.getByLabel('로그인 상태 유지').check()
  await page.getByRole('button', { name: '로그인', exact: true }).click()
}

async function mockContext() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const model = { mode: 'ok', signupCount: 0, loginCount: 0, refreshCount: 0, logoutCount: 0, meCount: 0, serial: 0, refresh: '', access: new Set(), used: new Set(), requests: [], protocolErrors: [] }
  function issue() {
    model.serial += 1
    model.refresh = `fixture-refresh-${model.serial}`
    const access = `fixture-access-${model.serial}`
    model.access.add(access)
    return { credential: { accessToken: access, expiresAt: new Date(Date.now() + 600_000).toISOString() }, refreshToken: model.refresh }
  }
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = request.method() === 'POST' ? request.postDataJSON() : null
    const headers = await request.allHeaders()
    model.requests.push(path)
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: status === 204 ? undefined : JSON.stringify(data) })
    try {
      if (path === '/api/v1/auth/signup') {
        model.signupCount += 1
        assert.deepEqual(Object.keys(body).sort(), ['displayName', 'email', 'password', 'requestedRole'])
        assert.equal(headers.authorization, undefined)
        assert.equal(body.requestedRole, 'THERAPIST')
        if (model.mode === 'duplicate') return reply(409, { code: 'ACCOUNT_ALREADY_EXISTS' })
        return reply(201, member)
      }
      if (path === '/api/v1/auth/login') {
        model.loginCount += 1
        assert.deepEqual(Object.keys(body).sort(), ['loginId', 'password'])
        assert.equal(headers.authorization, undefined)
        if (model.mode === 'offline') return route.abort('failed')
        if (model.mode === 'rate') return reply(429, { code: 'RATE_LIMITED' })
        if (model.mode === 'bad-login') return reply(401, { code: 'AUTH_REQUIRED' })
        return reply(200, issue())
      }
      if (path === '/api/v1/auth/refresh') {
        model.refreshCount += 1
        assert.equal(headers.authorization, undefined)
        assert.equal(headers['idempotency-key'], undefined)
        assert.deepEqual(Object.keys(body), ['refreshToken'])
        if (model.mode === 'lost-refresh') return route.abort('failed')
        assert.equal(body.refreshToken, model.refresh, 'Must consume the latest rotated refresh token')
        assert.equal(model.used.has(body.refreshToken), false, 'Must never reuse a consumed refresh token')
        model.used.add(body.refreshToken)
        await new Promise((resolve) => setTimeout(resolve, 50))
        return reply(200, issue())
      }
      if (path === '/api/v1/me') {
        model.meCount += 1
        assert.ok(model.access.has(headers.authorization?.replace('Bearer ', '')))
        if (model.mode === 'expired-access' && !model.deniedOnce) { model.deniedOnce = true; return reply(401, { code: 'TOKEN_EXPIRED' }) }
        if (model.mode === 'me-unavailable') return reply(503, { code: 'WORKER_UNAVAILABLE' })
        return reply(200, member)
      }
      if (path === '/api/v1/auth/logout') {
        model.logoutCount += 1
        assert.ok(model.access.has(headers.authorization?.replace('Bearer ', '')))
        assert.deepEqual(Object.keys(body), ['refreshToken'])
        assert.equal(body.refreshToken, model.refresh)
        if (model.mode === 'logout-offline') return route.abort('failed')
        return reply(204)
      }
      throw new Error(`Unexpected API path: ${path}`)
    } catch (error) {
      // Report protocol assertion descriptions, never request bodies or credentials.
      model.protocolErrors.push(error.operator || 'unexpected-request')
      return reply(500, { code: 'INTERNAL_ERROR' })
    }
  })
  return { context, model }
}

try {
  await check('Signup schema, password length, requested role, 201 state and duplicate email', async () => {
    const { context, model } = await mockContext()
    const page = await context.newPage()
    await open(page, 'signup')
    await page.getByLabel('이메일 주소').fill(member.email)
    await page.getByLabel('이름', { exact: false }).fill(member.displayName)
    await page.getByLabel('신청 역할').selectOption('THERAPIST')
    await page.getByLabel('비밀번호').fill('too-short')
    await page.getByRole('button', { name: '계정 만들기' }).click()
    await page.getByText('비밀번호는 15~128자로 입력해 주세요.').waitFor()
    assert.equal(model.signupCount, 0)
    await page.getByLabel('비밀번호').fill(password)
    model.mode = 'duplicate'
    await page.getByRole('button', { name: '계정 만들기' }).click()
    await page.getByText('이미 가입된 이메일 주소입니다. 로그인해 주세요.').waitFor()
    assert.equal(await page.getByLabel('이메일 주소').inputValue(), member.email)
    model.mode = 'ok'
    await page.getByRole('button', { name: '계정 만들기' }).click()
    await page.getByText('가입 신청을 완료했어요').waitFor()
    assert.equal(model.loginCount, 0)
    assert.equal(await page.locator('input[type=password]').count(), 0)
    assert.deepEqual(model.protocolErrors, [])
    await context.close()
  })

  await check('Login failures, 429 and network errors preserve input without automatic retries', async () => {
    const { context, model } = await mockContext()
    const page = await context.newPage()
    await open(page, 'login')
    for (const [mode, message] of [['bad-login', '이메일 주소 또는 비밀번호를 확인해 주세요.'], ['rate', '요청이 많습니다. 잠시 후 다시 시도해 주세요.'], ['offline', '서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.']]) {
      model.mode = mode
      const before = model.loginCount
      await fillLogin(page)
      await page.getByText(message).waitFor()
      assert.equal(model.loginCount, before + 1)
      assert.equal(await page.getByLabel('비밀번호').inputValue(), password)
      assert.equal(await page.evaluate(() => localStorage.length), 0)
    }
    assert.deepEqual(model.protocolErrors, [])
    await context.close()
  })

  await check('Persistent login, /me state, rotating refresh, concurrent tabs and logout propagation', async () => {
    const { context, model } = await mockContext()
    const page = await context.newPage()
    await open(page, 'login')
    await fillLogin(page, true)
    await page.getByRole('heading', { name: `${member.displayName}님` }).waitFor()
    await page.getByText('승인 대기', { exact: true }).waitFor()
    assert.ok(model.requests.every((path) => /\/auth\/|\/me$/.test(path)), 'Pending accounts must not request child/business data')
    const savedKeys = await page.evaluate((key) => Object.keys(JSON.parse(localStorage.getItem(key))).sort(), storageKey)
    assert.deepEqual(savedKeys, ['key', 'refreshToken', 'version'])
    assert.equal(await page.evaluate(() => sessionStorage.length), 0)
    await page.reload()
    await page.getByRole('heading', { name: `${member.displayName}님` }).waitFor()
    assert.equal(model.refreshCount, 1, 'StrictMode must not duplicate restore/rotation')
    const tabs = await Promise.all([context.newPage(), context.newPage()])
    await Promise.all(tabs.map((tab) => open(tab, 'account')))
    await Promise.all(tabs.map((tab) => tab.getByRole('heading', { name: `${member.displayName}님` }).waitFor()))
    assert.equal(model.refreshCount, 3)
    model.mode = 'logout-offline'
    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    await page.getByRole('alert').getByText('서버에 연결하지 못했어요.', { exact: false }).waitFor()
    assert.ok(await page.evaluate((key) => !!localStorage.getItem(key), storageKey), 'Failed logout must remain retryable')
    model.mode = 'ok'
    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    await Promise.all([page, ...tabs].map((tab) => tab.getByRole('button', { name: '로그인', exact: true }).waitFor()))
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), null)
    assert.deepEqual(model.protocolErrors, [])
    await context.close()
  })

  await check('Unchecked remember keeps credentials in memory only; /me failure can recover', async () => {
    const { context, model } = await mockContext()
    const page = await context.newPage()
    await open(page, 'login')
    model.mode = 'me-unavailable'
    await fillLogin(page)
    await page.getByRole('heading', { name: '계정 정보를 불러오지 못했어요' }).waitFor()
    model.mode = 'ok'
    await page.getByRole('button', { name: '다시 확인', exact: true }).click()
    await page.getByRole('heading', { name: `${member.displayName}님` }).waitFor()
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    await page.reload()
    await page.getByRole('button', { name: '로그인', exact: true }).waitFor()
    assert.equal(model.refreshCount, 0)
    assert.deepEqual(model.protocolErrors, [])
    await context.close()
  })

  await check('Expired access on /me refreshes once, replaces both tokens and retries only the read', async () => {
    const { context, model } = await mockContext()
    const page = await context.newPage()
    model.mode = 'expired-access'
    await open(page, 'login'); await fillLogin(page, true)
    await page.getByRole('heading', { name: `${member.displayName}님` }).waitFor()
    assert.equal(model.loginCount, 1)
    assert.equal(model.meCount, 2)
    assert.equal(model.refreshCount, 1)
    assert.deepEqual(model.protocolErrors, [])
    await context.close()
  })

  await check('Lost refresh response clears saved session and never replays the consumed secret', async () => {
    const { context, model } = await mockContext()
    const page = await context.newPage()
    await open(page, 'login'); await fillLogin(page, true)
    await page.getByRole('heading', { name: `${member.displayName}님` }).waitFor()
    model.mode = 'lost-refresh'
    await page.reload()
    await page.getByRole('button', { name: '로그인', exact: true }).waitFor()
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), null)
    await page.reload()
    await page.getByRole('button', { name: '로그인', exact: true }).waitFor()
    assert.equal(model.refreshCount, 1)
    assert.deepEqual(model.protocolErrors, [])
    await context.close()
  })

  if (process.argv.includes('--live')) {
    await check('LIVE local API: signup 201, login, /me PENDING, refresh rotation, logout 204 and revoked JWT 401', async () => {
      const context = await browser.newContext({ viewport: { width: 1250, height: 588 } })
      const page = await context.newPage()
      const email = `ui-auth-${randomUUID()}@example.test`
      const livePassword = `${randomUUID()}-UI-only!`
      let lastAccess = ''
      const statuses = []
      page.on('response', async (response) => {
        const path = new URL(response.url()).pathname
        if (!path.startsWith('/api/v1/')) return
        statuses.push({ path, status: response.status() })
        if ((path.endsWith('/login') || path.endsWith('/refresh')) && response.ok()) {
          const data = await response.json()
          lastAccess = data.credential.accessToken
        }
      })
      await open(page, 'signup')
      await page.getByLabel('이메일 주소').fill(email)
      await page.getByLabel('이름', { exact: false }).fill('프런트 연결 검증')
      await page.getByLabel('신청 역할').selectOption('THERAPIST')
      await page.getByLabel('비밀번호').fill(livePassword)
      await page.getByRole('button', { name: '계정 만들기' }).click()
      await page.getByText('가입 신청을 완료했어요').waitFor()
      await page.getByRole('link', { name: '로그인하기', exact: true }).click()
      await page.getByLabel('이메일 주소').fill(email)
      await page.getByLabel('비밀번호').fill(livePassword)
      await page.getByLabel('로그인 상태 유지').check()
      await page.getByRole('button', { name: '로그인', exact: true }).click()
      await page.getByRole('heading', { name: '프런트 연결 검증님' }).waitFor()
      await page.getByText('승인 대기', { exact: true }).waitFor()
      const oldRefresh = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).refreshToken, storageKey)
      await page.reload()
      await page.getByRole('heading', { name: '프런트 연결 검증님' }).waitFor()
      assert.ok(await page.evaluate(({ key, previous }) => JSON.parse(localStorage.getItem(key)).refreshToken !== previous, { key: storageKey, previous: oldRefresh }))
      await page.screenshot({ path: fileURLToPath(new URL('auth-live-account.png', output)), fullPage: true })
      await page.getByRole('button', { name: '로그아웃', exact: true }).click()
      await page.getByRole('button', { name: '로그인', exact: true }).waitFor()
      const revoked = await context.request.get(`${baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${lastAccess}` } })
      assert.equal(revoked.status(), 401)
      assert.ok(statuses.some((entry) => entry.path.endsWith('/signup') && entry.status === 201))
      assert.ok(statuses.some((entry) => entry.path.endsWith('/logout') && entry.status === 204))
      await writeFile(new URL('auth-live-statuses.json', output), JSON.stringify({ statuses, revokedAccessStatus: revoked.status(), syntheticAccountsCreated: 1 }, null, 2))
      await context.close()
    })
  }
  await writeFile(new URL('auth-result.json', output), JSON.stringify({ passed: results, live: process.argv.includes('--live'), baseUrl }, null, 2))
} finally { await browser.close() }
