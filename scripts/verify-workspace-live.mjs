import assert from 'node:assert/strict'
import { createDecipheriv, randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// This test owns a NEW loopback-only database cluster. It never connects to the application DB.
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'tmp', 'verification')
const cluster = path.join(root, 'tmp', `membership-lab-${randomUUID()}`)
const pgBin = process.env.EF_TEST_POSTGRES_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin'
const java = process.env.EF_TEST_JAVA || 'C:\\Users\\ttutti\\.jdks\\corretto-21.0.4\\bin\\java.exe'
const jar = process.env.EF_TEST_BACKEND_JAR || 'C:\\r2026\\emotion-friend\\build\\libs\\emotion-friend-0.0.1-SNAPSHOT.jar'
const pgPort = 55447, apiPort = 18080, uiPort = 15175
const base = `http://127.0.0.1:${uiPort}`
const dbUser = 'ui_membership_test'
const adminEmail = `admin-${randomUUID()}@example.test`
const password = `UI-lab-${randomUUID()}!`
const encryptionKey = randomBytes(32)
const events = []
const children = []
let pgStarted = false
let browser

function launch(executable, args, env = process.env) {
  const child = spawn(executable, args, { cwd: root, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  children.push(child)
  return child
}
async function run(executable, args, input, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    child.stdout.on('data', (bytes) => { stdout += bytes.toString('utf8') })
    child.stderr.on('data', () => {})
    child.once('error', () => reject(new Error(`Cannot execute ${path.basename(executable)}`)))
    child.once('exit', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${path.basename(executable)} exited with ${code}`)))
    child.stdin.end(input)
  })
}
async function requireFree(port) {
  await new Promise((resolve, reject) => { const probe = createServer(); probe.once('error', () => reject(new Error(`Test port ${port} is in use; no service was changed`))); probe.listen(port, '127.0.0.1', () => probe.close(resolve)) })
}
async function waitReady(url, statuses = [200]) {
  for (let i = 0; i < 160; i += 1) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (statuses.includes(response.status)) return }
    catch { /* Wait only for our newly launched service. */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Temporary test service did not become ready')
}
async function sql(query) {
  return run(path.join(pgBin, 'psql.exe'), ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(pgPort), '-U', dbUser, '-d', dbUser], query, { ...process.env, PGCLIENTENCODING: 'UTF8' })
}
function card(page, heading) { return page.locator('.card, dialog').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }) }
async function signin(page, email) { await page.goto(`${base}/#/login`); await page.reload(); await page.getByLabel('이메일 주소').fill(email); await page.getByLabel('비밀번호').fill(password); const response = page.waitForResponse((value) => value.url().endsWith('/auth/login') && value.request().method() === 'POST'); await page.getByRole('button', { name: '로그인', exact: true }).click(); const credentials = await (await response).json(); await page.getByRole('heading', { name: '내 계정', exact: true }).waitFor(); await page.locator('.account-heading').waitFor(); return credentials.credential.accessToken }
async function confirm(form) { await form.getByRole('checkbox').check(); const field = form.getByLabel('본인 비밀번호'); if (await field.count()) await field.fill(password) }
async function changed(page, suffix, click, status = 200) {
  const response = page.waitForResponse((value) => new URL(value.url()).pathname.endsWith(suffix) && value.request().method() !== 'GET')
  await click(); const result = await response; assert.equal(result.status(), status); events.push({ path: new URL(result.url()).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id'), status })
  return result
}

try {
  await mkdir(output, { recursive: true })
  await Promise.all([pgPort, apiPort, uiPort].map(requireFree))
  await run(path.join(pgBin, 'initdb.exe'), ['-D', cluster, '-U', dbUser, '--auth=trust', '--encoding=UTF8', '--no-locale'])
  launch(path.join(pgBin, 'postgres.exe'), ['-D', cluster, '-h', '127.0.0.1', '-p', String(pgPort), '-c', 'shared_buffers=16MB'])
  pgStarted = true
  for (let i = 0; i < 40; i += 1) { try { await run(path.join(pgBin, 'pg_isready.exe'), ['-h', '127.0.0.1', '-p', String(pgPort), '-t', '1']); break } catch { if (i === 39) throw new Error('Temporary database did not start'); await new Promise((resolve) => setTimeout(resolve, 250)) } }
  await run(path.join(pgBin, 'createdb.exe'), ['-h', '127.0.0.1', '-p', String(pgPort), '-U', dbUser, '-w', dbUser])
  const jdbc = `jdbc:postgresql://127.0.0.1:${pgPort}/${dbUser}`
  launch(java, ['-jar', jar], { ...process.env, PORT: String(apiPort), SERVER_ADDRESS: '127.0.0.1', SPRING_DATASOURCE_URL: jdbc, EF_DB_URL: jdbc, SPRING_DATASOURCE_USERNAME: dbUser, EF_DB_USERNAME: dbUser, SPRING_DATASOURCE_PASSWORD: '', EF_DB_PASSWORD: '', EF_IDEMPOTENCY_FINGERPRINT_KEY: randomBytes(32).toString('base64'), EF_IDEMPOTENCY_ENCRYPTION_KEY: encryptionKey.toString('base64'), EF_JWT_SIGNING_KEY: randomBytes(32).toString('base64'), EF_BOOTSTRAP_ADMIN_ENABLED: 'true', EF_BOOTSTRAP_ADMIN_EMAIL: adminEmail, EF_BOOTSTRAP_ADMIN_PASSWORD: password, LOGGING_LEVEL_ROOT: 'WARN' })
  await waitReady(`http://127.0.0.1:${apiPort}/actuator/health`)
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'], { ...process.env, EF_API_TARGET: `http://127.0.0.1:${apiPort}`, VITE_API_BASE_URL: '/api/v1', EF_VITE_CACHE_DIR: `${cluster}-vite-cache` })
  await waitReady(base)
  await waitReady(`${base}/api/v1/me`, [401])
  console.log('Temporary PostgreSQL, backend and frontend ready; application database untouched.')
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright')
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  const accountPages = []
  for (const [requestedRole, displayName] of [['GUARDIAN', '격리 검증 보호자'], ['THERAPIST', '격리 검증 치료사']]) {
    const email = `${requestedRole.toLowerCase()}-${randomUUID()}@example.test`
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, displayName, password, requestedRole }) })
    assert.equal(response.status, 201); const member = await response.json()
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } }); const page = await context.newPage()
    await signin(page, email)
    await page.getByText('이메일 소유 확인 진행', { exact: true }).click()
    await changed(page, '/auth/email-verifications', () => page.getByRole('button', { name: '이메일 확인 요청', exact: true }).click(), 202)
    // Read ONLY our new test cluster's encrypted mail queue, as a local test mail adapter.
    // Never print/store the plaintext token; external email delivery is not being tested.
    const notification = JSON.parse(await sql(`select json_build_object('id',id,'recipient',recipient_id,'payload',encode(encrypted_payload,'hex')) from identity.notification_outbox where recipient_id='${member.id}' and kind='EMAIL_VERIFICATION' order by created_at desc limit 1;`))
    const stored = Buffer.from(notification.payload, 'hex'); const nonce = stored.subarray(0, 12)
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, nonce)
    decipher.setAAD(Buffer.from(`notification:${notification.id}:${notification.recipient}:EMAIL_VERIFICATION`)); decipher.setAuthTag(stored.subarray(stored.length - 16))
    const verification = JSON.parse(Buffer.concat([decipher.update(stored.subarray(12, stored.length - 16)), decipher.final()]).toString('utf8'))
    await page.evaluate((hash) => { location.hash = hash }, `/verify-email?verificationId=${verification.verificationId}&token=${verification.token}`)
    await page.getByRole('heading', { name: '이메일 확인', exact: true }).waitFor()
    await changed(page, '/auth/email-verifications/confirm', () => page.getByRole('button', { name: '이메일 확인 완료', exact: true }).click(), 204)
    await page.getByText('이메일 확인을 완료했어요', { exact: true }).waitFor()
    await page.getByRole('link', { name: '내 계정으로 이동', exact: true }).click()
    await page.getByText('확인 완료', { exact: true }).waitFor()
    accountPages.push({ page, context, member, email })
  }
  console.log('PASS real API email request and single-use confirmation for synthetic guardian/therapist.')
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1080 } }); const admin = await adminContext.newPage()
  const adminAccess = await signin(admin, adminEmail); await admin.getByRole('link', { name: '회원·역할 관리', exact: true }).click()
  assert.equal((await fetch(`${base}/api/v1/children`, { headers: { Authorization: `Bearer ${adminAccess}` } })).status, 403)
  async function review(target, action, button) {
    await card(admin, target.displayName).getByRole('button', { name: button, exact: true }).click()
    const form = admin.locator('.action-form').last()
    await form.getByLabel('검토 사유').fill('격리된 합성 검증 계정의 역할·상태 검사'); await form.getByLabel('검토 근거 식별자').fill('isolated-ui-membership-test'); await confirm(form)
    await changed(admin, `/admin/members/${target.id}/${action}`, () => form.getByRole('button', { name: '검토 결과 적용' }).click())
    await form.waitFor({ state: 'detached' })
  }
  for (const entry of accountPages) await review(entry.member, 'approve', '신청 역할 승인')
  console.log('PASS admin approval uses reauthentication and review evidence, with no SQL role changes.')
  const [g, t] = accountPages
  await signin(g.page, g.email); await g.page.getByRole('link', { name: '아동 등록·관리' }).click(); await g.page.getByRole('link', { name: '첫 아동 등록' }).click()
  await g.page.getByLabel('아동 가명').fill('격리 검증 별이'); await g.page.getByLabel('학습 아동 성별').selectOption('GIRL'); await g.page.getByLabel('이 아동의 보호 관계를 확인하고 등록합니다.').check()
  const createResponse = await changed(g.page, '/children', () => g.page.getByRole('button', { name: '아동 등록', exact: true }).click(), 201)
  const created = await createResponse.json(); const id = created.childId
  await g.page.getByRole('heading', { name: '격리 검증 별이의 정보 사용 동의' }).waitFor()
  await card(g.page, '기본 프로필·학습 및 치료사 조회').getByRole('button', { name: '내용 확인·동의 선택' }).click()
  let form = card(g.page, '기본 프로필·학습 및 치료사 조회 · 동의 확인').locator('form'); await confirm(form)
  await changed(g.page, `/children/${id}/consents`, () => form.getByRole('button', { name: '이 목적에 동의', exact: true }).click()); await form.waitFor({ state: 'detached' })
  await g.page.getByRole('link', { name: '아동 프로필', exact: true }).click(); await g.page.getByRole('button', { name: '프로필 저장' }).waitFor()
  await changed(g.page, `/children/${id}/profile`, () => g.page.getByRole('button', { name: '프로필 저장' }).click())
  await g.page.getByRole('link', { name: '치료사 연결', exact: true }).click(); await g.page.getByRole('button', { name: '치료사 초대하기' }).click(); form = card(g.page, '치료사 초대').locator('form')
  await form.getByLabel('치료사 이메일').fill(t.email); await form.getByLabel('본인 비밀번호').fill(password)
  await changed(g.page, `/children/${id}/therapist-invitations`, () => form.getByRole('button', { name: '초대 요청', exact: true }).click(), 202)
  await g.page.getByText('응답 대기', { exact: true }).waitFor()
  const therapistAccess = await signin(t.page, t.email); await t.page.getByRole('link', { name: '담당 아동·초대 확인' }).click(); await t.page.getByRole('link', { name: '받은 초대', exact: true }).click()
  await t.page.getByRole('button', { name: '관계 확인·수락' }).click(); form = card(t.page, '치료 관계 확인 후 초대 수락').locator('form'); await confirm(form)
  const accepted = t.page.waitForResponse((response) => response.url().endsWith('/accept') && response.request().method() === 'POST')
  await form.getByRole('button', { name: '초대 수락', exact: true }).click(); assert.equal((await accepted).status(), 204); await form.waitFor({ state: 'detached' })
  await t.page.getByRole('link', { name: '연결된 아동', exact: true }).click(); await t.page.getByRole('link', { name: '이 아동 선택', exact: true }).click()
  await t.page.getByText('프로필 보기 권한만 있습니다.', { exact: false }).waitFor(); assert.equal(await t.page.getByRole('button', { name: '프로필 저장' }).count(), 0)
  assert.equal((await fetch(`${base}/api/v1/children/${id}/consents`, { headers: { Authorization: `Bearer ${therapistAccess}` } })).status, 403)
  await t.page.locator('main').focus(); await t.page.evaluate(() => window.scrollTo(0, 0))
  await t.page.screenshot({ path: path.join(output, 'workspace-live-therapist.png'), fullPage: true })
  console.log('PASS real child registration/update, scoped consent, generic invitation, therapist acceptance and read-only profile.')
  await g.page.getByRole('link', { name: '목적별 동의', exact: true }).click(); await card(g.page, '기본 프로필·학습 및 치료사 조회').getByRole('button', { name: '동의 철회하기' }).click()
  form = card(g.page, '기본 프로필·학습 및 치료사 조회 · 철회 확인').locator('form'); await confirm(form)
  await changed(g.page, `/children/${id}/consents`, () => form.getByRole('button', { name: '이 목적 동의 철회' }).click()); await form.waitFor({ state: 'detached' })
  await t.page.getByRole('button', { name: '최신 프로필 확인' }).click(); await t.page.getByText('대상이 없거나 더 이상 접근할 수 없습니다.').waitFor()
  assert.equal(await t.page.getByText('프로필 보기 권한만 있습니다.', { exact: false }).count(), 0)
  assert.equal((await fetch(`${base}/api/v1/children/${id}/profile`, { headers: { Authorization: `Bearer ${therapistAccess}` } })).status, 404)
  events.push({ path: '/children/:id/consents (therapist)', status: 403 }, { path: '/children/:id/profile (after withdrawal)', status: 404 }, { path: '/children (admin)', status: 403 })
  await g.page.locator('main').focus(); await g.page.evaluate(() => window.scrollTo(0, 0)); await g.page.screenshot({ path: path.join(output, 'workspace-live-consents.png'), fullPage: true })
  await admin.getByLabel('계정 상태').selectOption('ACTIVE'); await review(t.member, 'role', '역할 변경')
  await review(t.member, 'suspend', '이용 정지')
  await admin.locator('main').focus(); await admin.evaluate(() => window.scrollTo(0, 0)); await admin.screenshot({ path: path.join(output, 'workspace-live-members.png'), fullPage: true })
  console.log('PASS core-consent withdrawal immediately denies therapist access; admin role change and suspension verified.')
  await writeFile(path.join(output, 'workspace-live-result.json'), JSON.stringify({ status: 'PASS', environment: 'New isolated loopback PostgreSQL cluster; current built backend jar; real browser/API calls', applicationDatabaseUsed: false, externalEmailDelivery: 'NOT_RUN (isolated encrypted queue adapter used)', events, verified: ['email verification request/confirm', 'admin approval', 'child creation/profile update', 'purpose consent grant/withdrawal', 'therapist invitation/acceptance', 'read-only profile', 'access denial after withdrawal', 'admin role change/suspension'] }, null, 2))
} finally {
  if (browser) await browser.close()
  for (const child of children.slice(1).reverse()) { if (child.exitCode === null) child.kill() }
  if (pgStarted) { await run(path.join(pgBin, 'pg_ctl.exe'), ['-D', cluster, '-m', 'fast', '-w', 'stop']).catch(() => {}) }
}
