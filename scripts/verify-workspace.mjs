import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright')
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5175'
const output = new URL('../tmp/verification/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
const password = 'Workspace fixture password 123!'
const now = new Date().toISOString()
const makeMember = (role, name) => ({ id: randomUUID(), email: `${role.toLowerCase()}@example.test`, displayName: name, requestedRole: role === 'ADMIN' ? null : role, role, status: 'ACTIVE', emailVerified: true, createdAt: now })
const guardian = makeMember('GUARDIAN', '보호자 검증')
const therapist = makeMember('THERAPIST', '치료사 검증')
const admin = makeMember('ADMIN', '운영자 검증')
const pending = { ...makeMember('THERAPIST', '검토 대상'), role: null, status: 'PENDING' }
const members = [guardian, therapist, admin, pending]
const childId = randomUUID()
let child = null
let consent = null
let invitation = null
let connected = false
let profileConflict = false
let loseConsentResponse = true
let reauthBarrier
const tokens = new Map()
const refs = new Map()
const idempotency = new Map()
const counts = { create: 0, update: 0, consent: 0, invite: 0, accept: 0, review: 0, refresh: 0, reauth: 0 }
const protocolErrors = []
const calls = []
const results = []
const scopes = ['CORE_PROFILE_LEARNING', 'SPEECH_STT', 'CARD_EXTERNAL_PROCESSING', 'CAMERA_LOCAL', 'OPTIONAL_RESEARCH_OR_MODEL_TRAINING', 'LOCAL_DRAFT_RESUME']
const childSummary = (actor) => ({ childId, pseudonym: child.pseudonym, profileVersion: child.profileVersion, capabilities: actor.role === 'GUARDIAN' ? ['MANAGE', 'VIEW_PROFILE', 'EDIT_PROFILE', 'VIEW_SUMMARY'] : ['VIEW_PROFILE', 'VIEW_SUMMARY'] })

async function contextFor(actor) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } })
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url()); const path = url.pathname.replace('/api/v1', '')
    const headers = await req.allHeaders()
    const body = req.postData() ? req.postDataJSON() : undefined
    calls.push({ actor: actor.role, method: req.method(), path })
    const response = (status, value) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(value) })
    try {
      if (path === '/auth/login') { const access = randomUUID(); tokens.set(access, actor); return response(200, { credential: { accessToken: access, expiresAt: new Date(Date.now() + 600_000).toISOString() }, refreshToken: randomUUID() }) }
      if (path === '/auth/refresh') { counts.refresh += 1; return response(401, { code: 'AUTH_REQUIRED' }) }
      assert.equal(tokens.get(headers.authorization?.replace('Bearer ', ''))?.id, actor.id)
      if (path === '/me') return response(200, actor)
      if (path === '/auth/reauthenticate') {
        counts.reauth += 1
        if (reauthBarrier) await reauthBarrier
        if (body.password !== password) return response(401, { code: 'AUTH_REQUIRED' })
        const ref = randomUUID(); refs.set(actor.id, ref)
        return response(200, { verificationRef: ref, expiresAt: new Date(Date.now() + 300_000).toISOString() })
      }
      if (path === '/auth/email-verifications') return response(202, { message: 'accepted' })
      if (path === '/auth/email-verifications/confirm') return response(422, { code: 'VERIFICATION_INVALID' })
      if (path === '/admin/members' && req.method() === 'GET') {
        assert.equal(actor.role, 'ADMIN')
        return response(200, { items: members.filter((value) => !url.searchParams.get('status') || value.status === url.searchParams.get('status')), nextCursor: null })
      }
      if (path === '/children' && req.method() === 'GET') return response(200, { items: child && (actor.role === 'GUARDIAN' || (actor.role === 'THERAPIST' && connected && consent?.granted)) ? [childSummary(actor)] : [], nextCursor: null })
      if (path === '/consent-notices') return response(200, scopes.map((scope) => ({ scope, noticeVersion: 'fixture.v1', purpose: `처리 목적 안내 ${scope}`, defaultGranted: false })))
      if (path === `/children/${childId}/profile` && req.method() === 'GET') return response(200, child.profile)
      if (path === `/children/${childId}/consents` && req.method() === 'GET') { assert.equal(actor.role, 'GUARDIAN'); return response(200, { items: consent ? [consent] : [] }) }
      if (path === `/children/${childId}/therapist-invitations` && req.method() === 'GET') return response(200, { items: invitation ? [invitation] : [] })
      if (path === `/children/${childId}/therapists` && req.method() === 'GET') return response(200, { items: connected ? [{ therapistId: therapist.id, displayName: therapist.displayName, acceptedAt: now, capabilities: ['VIEW_PROFILE', 'VIEW_SUMMARY'] }] : [] })
      if (path === '/me/therapist-invitations') return response(200, { items: invitation?.state === 'PENDING' ? [{ invitationId: invitation.invitationId, guardianDisplayName: guardian.displayName, guardianContact: 'g***@example.test', createdAt: now, expiresAt: invitation.expiresAt, capabilities: ['VIEW_PROFILE', 'VIEW_SUMMARY'] }] : [] })
      assert.ok(headers['idempotency-key'], 'Domain writes require an idempotency key')
      const identity = `${actor.id}:${req.method()}:${path}:${headers['idempotency-key']}`
      if (idempotency.has(identity)) { const saved = idempotency.get(identity); assert.equal(saved.body, JSON.stringify(body)); return response(saved.status, saved.result) }
      let status = 200; let result
      if (path === '/children' && req.method() === 'POST') {
        assert.equal(actor.role, 'GUARDIAN'); assert.equal(body.guardianRelationshipConfirmed, true)
        assert.deepEqual(Object.keys(body).sort(), ['guardianRelationshipConfirmed', 'profile', 'pseudonym', 'schemaVersion'])
        assert.equal(body.profile.gender, 'GIRL'); assert.equal(body.profile.schemaVersion, '0.3.0')
        child = { pseudonym: body.pseudonym, profileVersion: 1, profile: { ...body.profile, childId, profileVersion: 1, createdAt: now } }; counts.create += 1; status = 201; result = child.profile
      } else if (path === `/children/${childId}/profile` && req.method() === 'PUT') {
        assert.equal(actor.role, 'GUARDIAN')
        if (profileConflict) return response(409, { code: 'RESOURCE_STATE_CONFLICT' })
        assert.equal(body.expectedProfileVersion, child.profileVersion)
        child.pseudonym = body.pseudonym; child.profileVersion += 1; child.profile = { ...body.profile, childId, profileVersion: child.profileVersion, createdAt: now }; counts.update += 1; result = child.profile
      } else if (path === `/children/${childId}/consents`) {
        assert.equal(actor.role, 'GUARDIAN'); assert.equal(body.guardianVerificationRef, refs.get(actor.id)); assert.equal(body.noticeVersion, 'fixture.v1')
        counts.consent += 1; consent = { ...body, consentId: randomUUID(), childId, recordedAt: now, withdrawnAt: body.granted ? null : now, revision: (consent?.revision ?? 0) + 1 }; result = consent
        if (!body.granted) { connected = false; if (invitation) invitation.state = 'CANCELLED' }
      } else if (path === `/children/${childId}/therapist-invitations`) {
        assert.equal(body.therapistEmail, therapist.email); assert.ok(refs.get(actor.id)); assert.equal(consent?.granted, true)
        invitation = { invitationId: randomUUID(), therapistEmail: body.therapistEmail, state: 'PENDING', createdAt: now, expiresAt: new Date(Date.now() + 86_400_000).toISOString() }; counts.invite += 1; status = 202; result = { message: 'accepted' }
      } else if (path === `/therapist-invitations/${invitation?.invitationId}/accept`) {
        assert.equal(actor.role, 'THERAPIST'); assert.equal(body.treatmentRelationshipConfirmed, true); assert.ok(refs.get(actor.id)); connected = true; invitation.state = 'ACCEPTED'; counts.accept += 1; status = 204
      } else if (path.startsWith(`/admin/members/${pending.id}/`)) {
        assert.equal(actor.role, 'ADMIN'); assert.ok(body.reason); assert.ok(body.reviewReference); assert.ok(refs.get(actor.id)); counts.review += 1
        const action = path.split('/').pop()
        if (action === 'approve') { pending.status = 'ACTIVE'; pending.role = pending.requestedRole }
        if (action === 'suspend') pending.status = 'SUSPENDED'
        if (action === 'role') { pending.role = body.role; pending.requestedRole = body.role }
        result = pending
      } else throw new Error('Unexpected operation')
      idempotency.set(identity, { body: JSON.stringify(body), status, result })
      if (path.endsWith('/consents') && loseConsentResponse) { loseConsentResponse = false; return route.abort('failed') }
      return response(status, result)
    } catch (error) { protocolErrors.push(`${req.method()} ${path}: ${error.operator || error.message}`); return response(500, { code: 'INTERNAL_ERROR' }) }
  })
  const page = await context.newPage()
  await page.goto(`${base}/#/login`)
  await page.getByLabel('이메일 주소').fill(actor.email); await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.getByRole('heading', { name: `${actor.displayName}님` }).waitFor()
  return { context, page }
}
async function check(name, action) { await action(); results.push(name); console.log(`PASS ${name}`) }
async function hash(page, path) { await page.evaluate((value) => { window.location.hash = value }, `/workspace/${path}`) }
async function confirm(form, value = password) { await form.getByRole('checkbox').check(); const field = form.getByLabel('본인 비밀번호'); if (await field.count()) await field.fill(value) }
async function distinctIcons(page) { const shapes = await page.locator('.navigation svg').evaluateAll((nodes) => nodes.map((node) => node.innerHTML)); assert.equal(new Set(shapes).size, shapes.length, 'Each workspace menu keeps its own icon'); return shapes }
const card = (page, title) => page.locator('.card, dialog').filter({ has: page.getByRole('heading', { name: title, exact: true }) })

try {
  const g = await contextFor(guardian)
  await check('Guardian child registration, schema, required relationship and server capabilities', async () => {
    await g.page.getByRole('link', { name: '아동 등록·관리' }).click()
    await g.page.getByRole('heading', { name: '등록된 아동이 없어요' }).waitFor()
    await g.page.getByRole('link', { name: '첫 아동 등록' }).click()
    await g.page.getByLabel('아동 가명').fill('연결 검증 별이'); await g.page.getByLabel('학습 아동 성별').selectOption('GIRL')
    await g.page.getByRole('button', { name: '아동 등록', exact: true }).click()
    assert.equal(counts.create, 0)
    await g.page.getByLabel('이 아동의 보호 관계를 확인하고 등록합니다.').check()
    await g.page.getByRole('button', { name: '아동 등록', exact: true }).click()
    await g.page.getByRole('heading', { name: '연결 검증 별이의 정보 사용 동의' }).waitFor()
    assert.equal(counts.create, 1)
    await distinctIcons(g.page)
  })
  await check('Common modal opens in top layer, traps focus, cancels without writes and fits short mobile screens', async () => {
    const trigger = card(g.page, '기본 프로필·학습 및 치료사 조회').getByRole('button', { name: '내용 확인·동의 선택' })
    await trigger.click()
    const dialog = g.page.getByRole('dialog', { name: '기본 프로필·학습 및 치료사 조회 · 동의 확인' })
    await dialog.waitFor()
    assert.equal(await dialog.evaluate((node) => node.matches(':modal')), true)
    assert.equal(await g.page.evaluate(() => document.body.style.overflow), 'hidden')
    await dialog.getByLabel('본인 비밀번호').fill('discard this value')
    for (let index = 0; index < 10; index += 1) {
      await g.page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true)
    }
    await g.page.screenshot({ path: fileURLToPath(new URL('consent-modal-desktop.png', output)) })
    await g.page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
    assert.notEqual(await g.page.evaluate(() => document.body.style.overflow), 'hidden')
    await trigger.click(); assert.equal(await dialog.getByLabel('본인 비밀번호').inputValue(), '')
    await dialog.getByRole('button', { name: '취소', exact: true }).click()
    assert.equal(counts.reauth, 0); assert.equal(counts.consent, 0)
    await g.page.setViewportSize({ width: 320, height: 568 }); await trigger.click()
    const size = await dialog.evaluate((node) => { const r = node.getBoundingClientRect(); const body = node.querySelector('.modal__body'); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, width: body.clientWidth, scrollWidth: body.scrollWidth } })
    assert.ok(size.left >= 0 && size.top >= 0 && size.right <= size.viewportWidth && size.bottom <= size.viewportHeight, JSON.stringify(size))
    assert.ok(size.scrollWidth <= size.width, JSON.stringify(size))
    await dialog.getByRole('button', { name: '취소', exact: true }).scrollIntoViewIfNeeded()
    await g.page.screenshot({ path: fileURLToPath(new URL('consent-modal-mobile.png', output)) })
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await g.page.setViewportSize({ width: 1440, height: 1080 })
  })
  await check('Consent defaults, wrong reauth preserves login, same-key uncertain replay is exactly once', async () => {
    assert.equal(await g.page.getByText('미동의', { exact: true }).count(), 6)
    await card(g.page, '기본 프로필·학습 및 치료사 조회').getByRole('button', { name: '내용 확인·동의 선택' }).click()
    const form = card(g.page, '기본 프로필·학습 및 치료사 조회 · 동의 확인').locator('form')
    await confirm(form, 'wrong-password'); await form.getByRole('button', { name: '이 목적에 동의', exact: true }).click()
    await form.getByText('비밀번호를 확인해 주세요.').waitFor(); assert.equal(counts.refresh, 0)
    await form.getByLabel('본인 비밀번호').fill(password); await form.getByRole('button', { name: '이 목적에 동의', exact: true }).click()
    await form.getByRole('button', { name: '같은 요청 결과 확인' }).waitFor()
    assert.equal(await form.getByLabel('본인 비밀번호').isDisabled(), true)
    assert.equal(await form.getByRole('button', { name: '취소', exact: true }).isDisabled(), true)
    await g.page.keyboard.press('Escape'); assert.equal(await g.page.getByRole('dialog').isVisible(), true)
    await form.getByRole('button', { name: '같은 요청 결과 확인' }).click()
    await g.page.getByText('선택한 목적에 동의했습니다.').waitFor(); assert.equal(counts.consent, 1)
  })
  await check('Profile optimistic version and conflict, then guardian invitation uses generic 202', async () => {
    await g.page.getByRole('link', { name: '아동 프로필', exact: true }).click()
    await g.page.getByRole('button', { name: '프로필 저장' }).waitFor()
    profileConflict = true; await g.page.getByRole('button', { name: '프로필 저장' }).click()
    await g.page.getByText('대상 상태가 변경되었거나 다른 기기에서 세션을 사용하고 있습니다.', { exact: false }).waitFor(); assert.equal(counts.update, 0)
    profileConflict = false; await g.page.getByRole('button', { name: '프로필 저장' }).click()
    await g.page.getByText('프로필을 저장했습니다.').waitFor(); assert.equal(counts.update, 1)
    await g.page.getByRole('link', { name: '치료사 연결', exact: true }).click()
    await g.page.getByRole('button', { name: '치료사 초대하기' }).click()
    const form = card(g.page, '치료사 초대').locator('form')
    await form.getByLabel('치료사 이메일').fill(therapist.email); await form.getByLabel('본인 비밀번호').fill(password)
    await form.getByRole('button', { name: '초대 요청', exact: true }).click()
    await g.page.getByText('초대 요청을 접수했습니다.', { exact: false }).waitFor(); assert.equal(counts.invite, 1)
  })
  const t = await contextFor(therapist)
  await check('Therapist cannot reach guardian/admin routes; inbox hides child info until confirmed acceptance', async () => {
    await hash(t.page, 'children/new'); await t.page.getByRole('heading', { name: '이 화면을 사용할 수 없어요' }).waitFor()
    await hash(t.page, 'members'); await t.page.getByRole('heading', { name: '이 화면을 사용할 수 없어요' }).waitFor()
    assert.equal(calls.some((value) => value.actor === 'THERAPIST' && value.path === '/admin/members'), false)
    await hash(t.page, 'invitations'); await t.page.getByRole('button', { name: '관계 확인·수락' }).waitFor()
    assert.equal(await t.page.getByText('연결 검증 별이', { exact: true }).count(), 0)
    await t.page.getByRole('button', { name: '관계 확인·수락' }).click()
    const form = card(t.page, '치료 관계 확인 후 초대 수락').locator('form')
    await form.getByLabel('본인 비밀번호').fill(password); await form.getByRole('button', { name: '초대 수락', exact: true }).click(); assert.equal(counts.accept, 0)
    await confirm(form); await form.getByRole('button', { name: '초대 수락', exact: true }).click()
    await t.page.getByText('초대를 수락했습니다.', { exact: false }).waitFor(); assert.equal(counts.accept, 1)
    await t.page.getByRole('link', { name: '연결된 아동', exact: true }).click(); await t.page.getByRole('link', { name: '이 아동 선택', exact: true }).click()
    await t.page.getByText('프로필 보기 권한만 있습니다.', { exact: false }).waitFor()
    await distinctIcons(t.page)
    assert.equal(await t.page.getByRole('button', { name: '프로필 저장' }).count(), 0)
    assert.equal(await t.page.getByRole('link', { name: '목적별 동의', exact: true }).count(), 0)
    await t.page.screenshot({ path: fileURLToPath(new URL('therapist-readonly.png', output)), fullPage: true })
  })
  await check('Core consent withdrawal clears therapist access instead of showing cached profile', async () => {
    await hash(g.page, `children/${childId}/consents`)
    await card(g.page, '기본 프로필·학습 및 치료사 조회').getByRole('button', { name: '동의 철회하기' }).click()
    const form = card(g.page, '기본 프로필·학습 및 치료사 조회 · 철회 확인').locator('form')
    await confirm(form); await form.getByRole('button', { name: '이 목적 동의 철회' }).click()
    await g.page.getByText('선택한 목적의 동의를 철회했습니다.', { exact: false }).waitFor()
    await t.page.getByRole('button', { name: '최신 프로필 확인' }).click()
    await t.page.getByText('대상이 없거나 더 이상 접근할 수 없습니다.').waitFor()
    assert.equal(await t.page.getByText('프로필 보기 권한만 있습니다.', { exact: false }).count(), 0)
  })
  await check('Leaving during reauthentication does not send a later consent write', async () => {
    await card(g.page, '기본 프로필·학습 및 치료사 조회').getByRole('button', { name: '내용 확인·동의 선택' }).click()
    const form = card(g.page, '기본 프로필·학습 및 치료사 조회 · 동의 확인').locator('form')
    let release
    reauthBarrier = new Promise((resolve) => { release = resolve })
    const before = counts.consent
    await confirm(form)
    const response = g.page.waitForResponse((value) => value.url().endsWith('/auth/reauthenticate'))
    await form.getByRole('button', { name: '이 목적에 동의', exact: true }).click()
    await form.getByRole('button', { name: '처리 중', exact: true }).waitFor()
    assert.equal(await g.page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).isDisabled(), true)
    await g.page.keyboard.press('Escape'); assert.equal(await g.page.getByRole('dialog').isVisible(), true)
    await hash(g.page, 'children')
    await g.page.getByRole('heading', { name: '학습 아동 선택', exact: true }).waitFor()
    release(); await response; reauthBarrier = undefined
    await g.page.waitForTimeout(100)
    assert.equal(counts.consent, before)
  })
  const a = await contextFor(admin)
  await check('Admin requestedRole=null, member approval/role/suspension with reauth and evidence', async () => {
    await a.page.getByRole('link', { name: '회원·역할 관리', exact: true }).click()
    await distinctIcons(a.page)
    await card(a.page, pending.displayName).getByRole('button', { name: '신청 역할 승인' }).click()
    await a.page.getByRole('dialog', { name: `${pending.displayName} · 신청 역할 승인 확인` }).waitFor()
    await a.page.screenshot({ path: fileURLToPath(new URL('member-approval-modal.png', output)) })
    async function apply() {
      const form = a.page.locator('.action-form').last()
      await form.getByLabel('검토 사유').fill('합성 검토 근거 확인'); await form.getByLabel('검토 근거 식별자').fill('fixture-review-001'); await confirm(form)
      await form.getByRole('button', { name: '검토 결과 적용' }).click()
      await a.page.getByText('서버에 검토 결과를 적용했습니다.', { exact: false }).waitFor()
    }
    await apply(); assert.equal(pending.status, 'ACTIVE')
    await a.page.getByLabel('계정 상태').selectOption('ACTIVE'); await card(a.page, pending.displayName).getByRole('button', { name: '역할 변경', exact: true }).click()
    await apply(); assert.equal(pending.role, 'GUARDIAN')
    await card(a.page, pending.displayName).getByRole('button', { name: '이용 정지', exact: true }).click(); await apply(); assert.equal(pending.status, 'SUSPENDED')
    assert.equal(counts.review, 3)
    await a.page.getByLabel('계정 상태').selectOption(''); await card(a.page, admin.displayName).getByText('운영자 계정은 이 화면에서 변경할 수 없습니다.').waitFor()
  })
  await check('Workspace wraps at 834/390/320px without horizontal overflow', async () => {
    for (const [subject, route] of [[g, `children/${childId}/consents`], [a, 'members']]) {
      await hash(subject.page, route); await subject.page.locator('.card').first().waitFor()
      for (const width of [834, 390, 320]) { await subject.page.setViewportSize({ width, height: 1000 }); const size = await subject.page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth })); assert.ok(size.scroll <= size.width, JSON.stringify(size)) }
    }
    await g.page.setViewportSize({ width: 1440, height: 1080 }); await g.page.locator('main').focus(); await g.page.evaluate(() => window.scrollTo(0, 0)); await g.page.screenshot({ path: fileURLToPath(new URL('guardian-consents.png', output)), fullPage: true })
    await a.page.setViewportSize({ width: 1440, height: 1080 }); await a.page.locator('main').focus(); await a.page.evaluate(() => window.scrollTo(0, 0)); await a.page.screenshot({ path: fileURLToPath(new URL('admin-members.png', output)), fullPage: true })
  })
  assert.deepEqual(protocolErrors, [])
  await writeFile(new URL('workspace-result.json', output), JSON.stringify({ passed: results, counts, protocolErrors, mode: 'isolated browser with contract fixtures' }, null, 2))
  await Promise.all([g.context.close(), t.context.close(), a.context.close()])
} finally { await browser.close() }
