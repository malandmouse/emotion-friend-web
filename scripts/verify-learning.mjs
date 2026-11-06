import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright')
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173'
const output = new URL('../tmp/verification/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
const now = new Date().toISOString()
const childId = randomUUID(), otherChild = randomUUID(), sessionId = randomUUID(), planId = randomUUID()
const checks = [], errors = [], protocolErrors = [], contexts = []
async function check(name, action) { await action(); checks.push(name); console.log(`PASS ${name}`) }
const card = (page, title) => page.locator('.card').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const open = (page, suffix) => page.evaluate((value) => { window.location.hash = value }, `/workspace/children/${childId}/${suffix}`)
const press = (page, name) => page.getByRole('button', { name, exact: true }).click()
function deferred() { let release; const promise = new Promise((resolve) => { release = resolve }); return { promise, release } }

async function setup(role, remember = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } }); contexts.push(context)
  const actor = { id: randomUUID(), email: `${role}@example.test`, displayName: `${role} 검증`, requestedRole: role === 'ADMIN' ? null : role, role, status: 'ACTIVE', emailVerified: true, createdAt: now }
  const state = { available: true, denied: false, stale: false, wrongChild: false, malformed: false, expired: false, session: null, receipts: new Map(), expressions: new Map(), idempotency: new Map(), writes: [], gets: [], commits: 0, loseFinalize: true, more: false, periods: [], materials: Array.from({ length: 7 }, (_, index) => ({ summaryId: randomUUID(), materialId: randomUUID(), subject: `검토 주제 ${index + 1}`, summary: `생성된 이야기 요약 ${index + 1}\n서로의 의사를 존중해요.`, status: 'UNCONFIRMED' })) }
  state.otherMaterial = { summaryId: randomUUID(), materialId: randomUUID(), subject: '다른 아동 주제', summary: '다른 아동의 요약', status: 'UNCONFIRMED' }
  const refreshToken = () => ({ credential: { accessToken: `fixture-${role}`, expiresAt: new Date(Date.now() + 600_000).toISOString() }, refreshToken: randomUUID() })
  function makeSession() { return { sessionId, childId, planId, dayIndex: 1, executionMode: 'DAY1', localDate: now.slice(0, 10), timezone: 'Asia/Seoul', status: 'ACTIVE', revision: 1, worldRevision: 0, stars: 0, completedCount: 0, slots: Array.from({ length: 5 }, (_, index) => ({ slot: index + 1, materialId: randomUUID(), scenarioVersionId: randomUUID(), completed: false, receiptId: null })) } }
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/v1', ''), headers = await req.allHeaders()
    const body = req.postData() ? req.postDataJSON() : undefined
    const reply = (status, value) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    try {
      if (path === '/auth/login' || path === '/auth/refresh') return reply(200, refreshToken())
      assert.equal(headers.authorization, `Bearer fixture-${role}`)
      if (path === '/me') return reply(200, actor)
      if (req.method() === 'GET') state.gets.push(path)
      if (path === '/children') return reply(200, { items: state.denied ? [] : [{ childId, pseudonym: '학습 검증 아동', profileVersion: 1, capabilities: role === 'GUARDIAN' ? ['MANAGE', 'VIEW_PROFILE', 'VIEW_SUMMARY'] : ['VIEW_PROFILE', 'VIEW_SUMMARY'] }, { childId: otherChild, pseudonym: '다른 아동', capabilities: ['VIEW_SUMMARY'] }], nextCursor: null })
      if (state.denied) return reply(403, { code: 'CHILD_ACCESS_DENIED' })
      const childPath = `/children/${childId}`
      if (req.method() === 'GET' && path === `/children/${otherChild}/learning-material-summaries`) return reply(200, { childId: otherChild, items: [state.otherMaterial], nextCursor: null })
      if (req.method() === 'GET' && path === `${childPath}/learning-material-summaries`) {
        const filter = url.searchParams.get('status')
        const items = state.materials.filter((item) => filter ? item.status === filter : item.status !== 'CONFIRMED')
        if (state.delaySummary) {
          const { entered, response } = state.delaySummary
          state.delaySummary = null
          entered.release()
          await response.promise
          return await reply(200, { childId, items, nextCursor: null }).catch(() => {})
        }
        if (state.consentRevoked) return reply(403, { code: 'CONSENT_REQUIRED' })
        return reply(200, { childId, items: state.malformed ? [{ ...items[0], summaryId: null }] : items, nextCursor: null })
      }
      if (req.method() === 'GET' && path === `${childPath}/learning-sessions`) return reply(200, { childId, items: state.session ? [{ ...state.session, startedAt: now, completedAt: state.session.status === 'COMPLETED' ? now : null }] : [], nextCursor: null })
      if (req.method() === 'GET' && path === `/learning-sessions/${sessionId}`) return reply(200, { ...state.session, childId: state.wrongChild ? otherChild : childId })
      const receiptMatch = path.match(new RegExp(`^/learning-sessions/${sessionId}/slots/([1-5])/receipt$`))
      if (receiptMatch && req.method() === 'GET') { const receipt = state.receipts.get(Number(receiptMatch[1])); return receipt ? reply(200, receipt) : reply(404, { code: 'RESOURCE_NOT_FOUND' }) }
      if (req.method() === 'GET' && path === `${childPath}/learning-records`) return reply(200, { childId, items: url.searchParams.has('cursor') ? [] : [...state.receipts.values()].map((receipt) => ({ receiptId: receipt.receiptId, sessionId, planId, slot: receipt.slot, subject: `완료한 주제 ${receipt.slot}`, completedAt: receipt.completedAt, starsAwarded: receipt.starsAwarded })), nextCursor: !url.searchParams.has('cursor') && state.more ? randomUUID() : null })
      if (req.method() === 'GET' && path === `${childPath}/learning-summary`) {
        state.periods.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') })
        return reply(200, { periodStart: url.searchParams.get('from') || new Date(Date.now() - 30 * 86_400_000).toISOString(), periodEnd: url.searchParams.get('to') || now, completedLoops: state.receipts.size, starsEarned: state.receipts.size, recognitionCounts: [], assistanceCounts: [], metricSnapshotHash: 'fixture-snapshot-hash', limitations: ['RECOGNITION_NOT_COLLECTED', 'ASSISTANCE_NOT_COLLECTED', 'NOT_A_DIAGNOSTIC_SCORE'] })
      }
      assert.equal(req.method(), 'POST'); assert.ok(headers['idempotency-key']); assert.notEqual(role, 'ADMIN')
      const key = headers['idempotency-key'], identity = `${path}:${key}`
      state.writes.push({ path, key, body })
      if (state.idempotency.has(identity)) { const saved = state.idempotency.get(identity); assert.deepEqual(body, saved.body); return reply(saved.status, saved.value) }
      let value, status = 200
      if (path === `${childPath}/learning-material-confirmations`) {
        assert.ok(body.summaryIds.length >= 1 && body.summaryIds.length <= 5); assert.equal(new Set(body.summaryIds).size, body.summaryIds.length)
        if (state.stale) { state.stale = false; state.materials = state.materials.filter((item) => !body.summaryIds.includes(item.summaryId)); return reply(409, { code: 'STALE_DRAFT' }) }
        state.materials.forEach((item) => { if (body.summaryIds.includes(item.summaryId)) item.status = body.decision === 'CONFIRM' ? 'CONFIRMED' : 'ON_HOLD' })
        value = { childId, items: state.materials.filter((item) => body.summaryIds.includes(item.summaryId)), nextCursor: null }
      } else {
        assert.equal(role, 'GUARDIAN')
        if (path === `${childPath}/learning-sessions`) {
          assert.deepEqual(body, { schemaVersion: '0.3.0', deviceId: 'device-test-1' })
          if (!state.available) return reply(409, { code: 'MATERIAL_NOT_READY' })
          status = state.session ? 200 : 201; state.session ??= makeSession(); value = state.session
        } else if (path.endsWith('/confirmed-expressions')) {
          assert.equal(body.childConfirmed, true); assert.equal(body.inputSource, 'TYPED'); assert.ok(body.text)
          value = { confirmedExpressionRef: randomUUID(), expiresAt: new Date(Date.now() + 900_000).toISOString(), draftVersion: body.draftVersion }; state.expressions.set(value.confirmedExpressionRef, value); status = 201
        } else if (path.endsWith('/finalize')) {
          if (state.expired) return reply(409, { code: 'REWARD_WINDOW_EXPIRED' })
          const slot = Number(path.split('/').at(-2)); assert.equal(slot, state.session.completedCount + 1)
          assert.deepEqual(body.selectedChoiceIds, ['choose-respect']); assert.equal(body.terminalSceneId, 'ending-respect'); assert.equal(body.selectedEmotionId, 'calm'); assert.equal(body.expressionChoice, 'ORIGINAL'); assert.equal(body.expectedSessionRevision, state.session.revision); assert.equal(body.expectedWorldRevision, state.session.worldRevision); assert.ok(state.expressions.has(body.confirmedExpressionRef)); assert.ok(body.clientCommitId)
          state.commits += 1; state.session.revision += 1; state.session.worldRevision += 1; state.session.stars += 1; state.session.completedCount += 1
          if (state.session.completedCount === 5) state.session.status = 'COMPLETED'
          value = { receiptId: randomUUID(), sessionId, planId, slot, completedAt: now, worldRevision: state.session.worldRevision, starsAwarded: 1, stars: state.session.stars, completedCount: state.session.completedCount, confirmedExpressionRef: body.confirmedExpressionRef, draftVersion: body.draftVersion, expressionChoice: 'ORIGINAL', actorId: 'friend', nextAction: 'CHARACTER_REPLY' }
          state.session.slots[slot - 1] = { ...state.session.slots[slot - 1], completed: true, receiptId: value.receiptId }; state.receipts.set(slot, value)
        } else throw new Error(`Unexpected write ${path}`)
      }
      state.idempotency.set(identity, { body, value: structuredClone(value), status })
      if (path.endsWith('/finalize') && state.loseFinalize) { state.loseFinalize = false; return route.abort('failed') }
      return reply(status, value)
    } catch (error) { protocolErrors.push(`${req.method()} ${path}: ${error.operator || error.message}`); return reply(500, { code: 'INTERNAL_ERROR' }) }
  })
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/#/login`); await page.getByLabel('이메일 주소').fill(actor.email); await page.getByLabel('비밀번호').fill('Synthetic fixture password 123!')
  if (remember) await page.getByLabel('로그인 상태 유지').check()
  await press(page, '로그인'); await page.getByRole('heading', { name: `${actor.displayName}님` }).waitFor()
  return { page, state, context }
}
async function confirmExpression(page) {
  await page.getByText('직접 입력 확정과 완료 연결', { exact: true }).click()
  await page.getByLabel('아동이 확인할 직접 입력').fill('합성 검증 입력')
  await page.getByLabel('아동이 이 입력을 직접 확인했습니다.').check()
  await press(page, '아동이 확인한 입력 확정')
  await page.getByLabel('마지막 장면 식별자').waitFor()
  await page.getByLabel('선택한 경로 식별자').fill('choose-respect'); await page.getByLabel('마지막 장면 식별자').fill('ending-respect'); await page.getByLabel('선택한 감정 식별자').fill('calm')
  await page.getByLabel('실제 학습 실행에서 선택한 경로·감정이며').check()
}
try {
  const g = await setup('GUARDIAN', true), { page, state } = g
  await check('Review requires 1–5 items and supports atomic hold, confirm, confirmed history', async () => {
    await open(page, 'review'); await page.getByRole('heading', { name: '주제·요약 검토', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '선택한 요약 검토하기' }).isDisabled(), true); assert.equal(state.writes.length, 0)
    for (let i = 1; i <= 5; i++) await page.getByLabel(`검토 주제 ${i}`, { exact: true }).check()
    assert.equal(await page.getByLabel('검토 주제 6', { exact: true }).isDisabled(), true)
    await press(page, '선택한 요약 검토하기'); await page.getByRole('dialog', { name: '선택한 주제·요약 검토' }).waitFor()
    await page.getByRole('combobox', { name: /^검토 결과/ }).selectOption('HOLD'); await page.getByLabel('선택한 주제·요약을 읽고').check()
    await page.getByRole('button', { name: '선택한 요약에 적용' }).evaluate((button) => { button.click(); button.click() })
    await page.getByText('선택한 주제·요약의 검토 결과를 저장했습니다.').waitFor()
    assert.equal(state.writes.length, 1)
    assert.equal(state.materials.filter((item) => item.status === 'ON_HOLD').length, 5)
    await page.getByLabel('검토 상태').selectOption('ON_HOLD'); await page.getByLabel('검토 주제 1', { exact: true }).check(); await press(page, '선택한 요약 검토하기'); await page.getByRole('combobox', { name: /^검토 결과/ }).selectOption('CONFIRM'); await page.getByLabel('선택한 주제·요약을 읽고').check(); await press(page, '선택한 요약에 적용')
    await page.getByLabel('검토 주제 1', { exact: true }).waitFor({ state: 'detached' }); await page.getByLabel('검토 상태').selectOption('CONFIRMED'); await page.getByLabel('검토 주제 1', { exact: true }).waitFor()
    await page.screenshot({ path: fileURLToPath(new URL('learning-review.png', output)), fullPage: true })
  })
  await check('Stale summaries refresh without overwriting and malformed response is rejected', async () => {
    state.stale = true
    await page.getByLabel('검토 주제 1', { exact: true }).check(); await press(page, '선택한 요약 검토하기'); await page.getByRole('combobox', { name: /^검토 결과/ }).selectOption('HOLD'); await page.getByLabel('선택한 주제·요약을 읽고').check(); await press(page, '선택한 요약에 적용')
    await page.getByText('요약 버전이 변경되었거나 입력 확정 참조가 만료되었습니다.', { exact: false }).waitFor(); await page.getByRole('heading', { name: '해당 상태의 콘텐츠가 없어요' }).waitFor()
    state.malformed = true; await page.getByLabel('검토 상태').selectOption(''); await page.getByRole('heading', { name: '화면을 불러오지 못했어요' }).waitFor(); assert.equal(await page.getByText('생성된 이야기 요약 2', { exact: false }).count(), 0); state.malformed = false
  })
  await check('Delayed child response is cancelled on route change and excluded from the current view', async () => {
    const delayed = { entered: deferred(), response: deferred() }
    state.delaySummary = delayed
    await press(page, '다시 확인')
    await delayed.entered.promise
    await page.getByRole('status').filter({ hasText: '불러오는 중이에요' }).waitFor()
    assert.equal(await page.getByText('생성된 이야기 요약', { exact: false }).count(), 0)
    const cancelled = page.waitForEvent('requestfailed', { predicate: (request) => request.url().includes(`/${childId}/learning-material-summaries`) })
    await page.evaluate((id) => { window.location.hash = `/workspace/children/${id}/review` }, otherChild)
    await page.getByLabel('다른 아동 주제').waitFor()
    await cancelled
    delayed.response.release()
    assert.equal(await page.getByText('생성된 이야기 요약', { exact: false }).count(), 0)
  })
  await check('Reconnect rechecks consent and removes private results on revocation', async () => {
    Object.assign(state.materials[1], { originalText: '비공개 원문 fixture', memory: '비공개 기억 fixture', manuscript: '비공개 원고 fixture', candidates: ['비공개 후보 fixture'] })
    await open(page, 'review'); await page.getByRole('heading', { name: '주제·요약 검토', exact: true }).waitFor()
    assert.equal((await page.locator('main').innerText()).includes('비공개'), false)
    state.consentRevoked = true
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.getByRole('alert').filter({ hasText: '기본 프로필·학습 동의가 필요합니다.' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: '주제·요약 검토', exact: true }).count(), 0)
    state.consentRevoked = false
  })
  await check('Unavailable published material is explained; session accepts both 201 start and 200 restore', async () => {
    await open(page, 'sessions'); await page.getByLabel('실행 기기 식별자').fill('device-test-1'); state.available = false; await press(page, '세션 시작·복원')
    await page.getByText('발행된 학습 자료가 아직 준비되지 않았습니다.', { exact: false }).waitFor(); state.available = true; await press(page, '세션 시작·복원'); await page.getByRole('heading', { name: /이야기 1 · 실행 결과 연결/ }).waitFor()
    await open(page, 'sessions'); await page.getByLabel('실행 기기 식별자').fill('device-test-1'); await press(page, '세션 시작·복원'); await page.getByRole('heading', { name: /이야기 1 · 실행 결과 연결/ }).waitFor()
  })
  await check('No receipt is reported as missing; confirm alone creates no completion or star', async () => {
    await page.getByRole('button', { name: '완료 여부 복구 조회' }).first().click(); await card(page, '이야기 1 · 완료 receipt').getByText('아직 저장된 완료가 없어요').waitFor()
    await confirmExpression(page); assert.equal(state.commits, 0); assert.equal(state.session.stars, 0)
  })
  await check('Lost finalize response freezes input; identical idempotency key, body and clientCommitId replay once', async () => {
    await press(page, '실행 결과 검증·완료 저장'); await page.getByRole('button', { name: '같은 요청 결과 확인' }).waitFor()
    assert.equal(await page.getByLabel('마지막 장면 식별자').isDisabled(), true); assert.equal(await page.getByRole('button', { name: '입력을 바꾸거나 다시 확정' }).isDisabled(), true)
    await press(page, '같은 요청 결과 확인'); await page.getByText('이야기 1의 완료가 수락되었습니다').waitFor(); assert.equal(state.commits, 1)
    const writes = state.writes.filter((write) => write.path.endsWith('/finalize')); assert.equal(writes.length, 2); assert.equal(writes[0].key, writes[1].key); assert.deepEqual(writes[0].body, writes[1].body)
    assert.equal(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]).includes('합성 검증 입력')), false)
  })
  await check('Receipt snapshot stays at acceptance while current session advances', async () => {
    await confirmExpression(page); await press(page, '실행 결과 검증·완료 저장'); await page.getByText('이야기 2의 완료가 수락되었습니다').waitFor(); assert.equal(state.commits, 2)
    await page.getByRole('button', { name: 'receipt 보기', exact: true }).first().click(); await page.getByText('이야기 1의 완료가 수락되었습니다').waitFor()
    const receipt = card(page, '이야기 1 · 완료 receipt'); assert.equal(await receipt.locator('dd').filter({ hasText: '1 / 5개' }).count(), 2)
    await page.screenshot({ path: fileURLToPath(new URL('learning-session.png', output)), fullPage: true })
  })
  await check('Expired reward window prevents additional completion and preserves accepted receipts', async () => {
    state.expired = true; await confirmExpression(page); await press(page, '실행 결과 검증·완료 저장'); await page.getByText('이 세션의 보상 날짜가 지났습니다.', { exact: false }).waitFor(); assert.equal(state.commits, 2)
    await page.getByRole('button', { name: 'receipt 보기', exact: true }).first().click(); await page.getByText('이야기 1의 완료가 수락되었습니다').waitFor()
  })
  await check('Results use accepted receipts, explain missing metrics, paginate and convert inclusive Seoul dates to exclusive UTC', async () => {
    state.more = true; await open(page, 'records'); await page.getByRole('heading', { name: '전체 완료 기록' }).waitFor(); await page.getByText('인식 관찰 지표는 아직 수집되지 않았습니다.').waitFor()
    await page.getByLabel('시작일').fill('2026-10-01'); await page.getByLabel('종료일').fill('2026-10-31'); await press(page, '기간 적용'); await page.getByText('2026. 10. 1.', { exact: false }).waitFor()
    assert.deepEqual(state.periods.at(-1), { from: '2026-09-30T15:00:00.000Z', to: '2026-10-31T15:00:00.000Z' })
    const before = state.periods.length; await page.getByLabel('시작일').fill('2025-01-01'); await press(page, '기간 적용'); await page.getByText('시작일과 종료일을 확인해 주세요.', { exact: false }).waitFor(); assert.equal(state.periods.length, before)
    await press(page, '다음 목록'); await page.getByRole('heading', { name: '아직 완료 기록이 없어요' }).waitFor(); await press(page, '처음 목록'); await page.getByRole('link', { name: '완료 receipt 보기' }).first().waitFor()
    await page.screenshot({ path: fileURLToPath(new URL('learning-records.png', output)), fullPage: true })
    await page.getByRole('link', { name: '완료 receipt 보기' }).first().click(); await page.getByText('이야기 1의 완료가 수락되었습니다').waitFor()
  })
  await check('Session from another child is rejected without exposing completion data', async () => {
    state.wrongChild = true; await press(page, '세션 상태 확인'); await page.getByRole('heading', { name: '화면을 불러오지 못했어요' }).waitFor(); assert.equal(await page.getByText('현재 누적 별', { exact: true }).count(), 0); state.wrongChild = false
  })
  const t = await setup('THERAPIST')
  t.state.session = structuredClone(state.session); t.state.receipts = new Map(state.receipts)
  await check('Therapist can hold summaries with VIEW_SUMMARY but has no start, expression or finalize controls', async () => {
    await open(t.page, 'review'); await t.page.getByLabel('검토 주제 1', { exact: true }).check(); await press(t.page, '선택한 요약 검토하기'); await t.page.getByRole('combobox', { name: /^검토 결과/ }).selectOption('HOLD'); await t.page.getByLabel('선택한 주제·요약을 읽고').check(); await press(t.page, '선택한 요약에 적용'); await t.page.getByText('선택한 주제·요약의 검토 결과를 저장했습니다.').waitFor()
    await open(t.page, 'sessions'); await t.page.getByRole('link', { name: '세션 상세·receipt' }).click(); await t.page.getByText('현재 누적 별', { exact: true }).waitFor()
    assert.equal(await t.page.getByRole('button', { name: '세션 시작·복원' }).count(), 0); assert.equal(await t.page.getByText('직접 입력 확정과 완료 연결', { exact: true }).count(), 0)
    assert.equal(t.state.writes.some((write) => !write.path.endsWith('learning-material-confirmations')), false)
  })
  await check('Access revocation removes loaded results and blocks further child API reads', async () => {
    await open(t.page, 'records'); await t.page.getByRole('heading', { name: '전체 완료 기록' }).waitFor(); const count = t.state.gets.filter((path) => path.endsWith('learning-records')).length
    t.state.denied = true; await press(t.page, '기록 새로고침'); await t.page.getByText('대상이 없거나 더 이상 접근할 수 없습니다.').waitFor(); assert.equal(await t.page.getByRole('heading', { name: '전체 완료 기록' }).count(), 0); assert.equal(t.state.gets.filter((path) => path.endsWith('learning-records')).length, count)
  })
  const a = await setup('ADMIN')
  await check('Admin direct learning URLs do not call child APIs', async () => {
    for (const route of ['review', 'sessions', `sessions/${sessionId}`, 'records']) { await open(a.page, route); await a.page.getByRole('heading', { name: '이 화면을 사용할 수 없어요' }).waitFor() }
    assert.equal(a.state.gets.length, 0)
  })
  await check('All five sequential receipts complete the session with five stars and no further completion control', async () => {
    state.expired = false
    await open(page, `sessions/${sessionId}`); await page.getByRole('heading', { name: '이야기 3 · 실행 결과 연결', exact: true }).waitFor()
    for (const slot of [3, 4, 5]) { await confirmExpression(page); await press(page, '실행 결과 검증·완료 저장'); await page.getByText(`이야기 ${slot}의 완료가 수락되었습니다`).waitFor() }
    assert.equal(state.commits, 5); assert.equal(state.session.stars, 5)
    assert.equal(await page.getByText('직접 입력 확정과 완료 연결', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'receipt 보기', exact: true }).count(), 5)
  })
  await check('Reload and reconnect recover a stored receipt using reads only', async () => {
    const before = state.writes.length
    await open(page, `sessions/${sessionId}?receipt=1`)
    await page.getByText('이야기 1의 완료가 수락되었습니다').waitFor()
    await page.reload()
    await page.getByText('이야기 1의 완료가 수락되었습니다').waitFor()
    const read = page.waitForResponse((response) => response.url().endsWith('/slots/1/receipt') && response.request().method() === 'GET')
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await read
    assert.equal(state.writes.length, before)
  })
  await check('Learning pages fit 834, 390 and 320px and render without JavaScript errors', async () => {
    for (const suffix of ['review', 'records', `sessions/${sessionId}`]) {
      await open(page, suffix); await page.locator('.card').first().waitFor(); await page.evaluate(() => document.fonts.ready)
      for (const width of [834, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${suffix} at ${width}`) }
    }
    await page.screenshot({ path: fileURLToPath(new URL('learning-mobile-320.png', output)), fullPage: true })
    assert.deepEqual(errors, []); assert.deepEqual(protocolErrors, [])
  })
  await writeFile(new URL('learning-result.json', output), JSON.stringify({ mode: 'isolated browser with current learning API contract fixtures', passed: checks, errors, protocolErrors, acceptedCompletions: state.commits }, null, 2))
} finally { await Promise.all(contexts.map((context) => context.close())); await browser.close() }
