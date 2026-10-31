import { ApiFailure, isObject } from '../api/client'
import { authenticatedApi } from '../auth/session'
import { childPath, findChild } from './api'
import { page, uuid } from './contracts'

export type MaterialStatus = 'UNCONFIRMED' | 'ON_HOLD' | 'CONFIRMED'
export interface MaterialSummary { summaryId: string; materialId: string; subject: string; summary: string; status: MaterialStatus }
export type SessionStatus = 'ACTIVE' | 'COMPLETED'
export interface SessionItem { sessionId: string; planId: string; dayIndex: number; localDate: string; timezone: string; status: SessionStatus; stars: number; completedCount: number; startedAt: string; completedAt: string | null }
export interface SessionSlot { slot: number; materialId: string; scenarioVersionId: string; completed: boolean; receiptId: string | null }
export interface LearningSession { sessionId: string; childId: string; planId: string; dayIndex: number; executionMode: string; localDate: string; timezone: string; status: SessionStatus; revision: number; worldRevision: number; stars: number; completedCount: number; slots: SessionSlot[] }
export interface Receipt { receiptId: string; sessionId: string; planId: string; slot: number; completedAt: string; worldRevision: number; starsAwarded: number; stars: number; completedCount: number; confirmedExpressionRef: string; draftVersion: number; expressionChoice: string; actorId: string; nextAction: string }
export interface LearningResult { receiptId: string; sessionId: string; planId: string; slot: number; subject: string; completedAt: string; starsAwarded: number }
export interface LearningSummary { periodStart: string; periodEnd: string; completedLoops: number; starsEarned: number; recognitionCounts: { key: string; count: number }[]; assistanceCounts: { key: string; count: number }[]; metricSnapshotHash: string; limitations: string[] }
export interface Expression { confirmedExpressionRef: string; expiresAt: string; draftVersion: number }
export const materialLabels = { UNCONFIRMED: '미확인', ON_HOLD: '보류', CONFIRMED: '확인 완료' }
export const sessionLabels = { ACTIVE: '진행 중', COMPLETED: '완료' }
export const sessionPath = (id: string) => `/learning-sessions/${uuid(id)}`
export const sessionHref = (childId: string, sessionId: string) => `#/workspace/children/${childId}/sessions/${sessionId}`
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const invalid = () => new ApiFailure('INVALID_RESPONSE')
function status(value: unknown): value is SessionStatus { return value === 'ACTIVE' || value === 'COMPLETED' }
function counts(value: Record<string, unknown>) { return integer(value.stars, 0, 5) && integer(value.completedCount, 0, 5) }
function sessionItem(value: unknown): value is SessionItem {
  return isObject(value) && id(value.sessionId) && id(value.planId) && integer(value.dayIndex, 1) && date(value.localDate) && typeof value.timezone === 'string' && status(value.status) && counts(value) && date(value.startedAt) && (value.completedAt === null || date(value.completedAt))
}
function material(value: unknown): value is MaterialSummary { return isObject(value) && id(value.summaryId) && id(value.materialId) && typeof value.subject === 'string' && typeof value.summary === 'string' && ['UNCONFIRMED', 'ON_HOLD', 'CONFIRMED'].includes(String(value.status)) }
function result(value: unknown): value is LearningResult { return isObject(value) && id(value.receiptId) && id(value.sessionId) && id(value.planId) && integer(value.slot, 1, 5) && typeof value.subject === 'string' && date(value.completedAt) && integer(value.starsAwarded, 0, 1) }
function learningPage<T>(raw: unknown, childId: string, validate: (value: unknown) => value is T) {
  if (!isObject(raw) || raw.childId !== childId) throw invalid()
  const parsed = page<unknown>(raw)
  if (parsed.nextCursor !== null && !id(parsed.nextCursor) || parsed.items.some((item) => !validate(item))) throw invalid()
  return { items: parsed.items as T[], nextCursor: parsed.nextCursor }
}
export function parseSession(raw: unknown, childId: string, sessionId?: string): LearningSession {
  if (!isObject(raw) || !id(raw.sessionId) || sessionId && raw.sessionId !== sessionId || raw.childId !== childId || !id(raw.planId) || !integer(raw.dayIndex, 1) || typeof raw.executionMode !== 'string' || !date(raw.localDate) || typeof raw.timezone !== 'string' || !status(raw.status) || !counts(raw) || !integer(raw.revision, 1) || !integer(raw.worldRevision) || !Array.isArray(raw.slots) || raw.slots.length !== 5) throw invalid()
  if (raw.slots.some((slot, index) => !isObject(slot) || slot.slot !== index + 1 || !id(slot.materialId) || !id(slot.scenarioVersionId) || typeof slot.completed !== 'boolean' || (slot.completed ? !id(slot.receiptId) : slot.receiptId !== null))) throw invalid()
  return raw as unknown as LearningSession
}
export function parseReceipt(raw: unknown, sessionId: string, slot: number, planId: string): Receipt {
  if (!isObject(raw) || !id(raw.receiptId) || raw.sessionId !== sessionId || raw.planId !== planId || raw.slot !== slot || !date(raw.completedAt) || !integer(raw.worldRevision) || !integer(raw.starsAwarded, 0, 1) || !counts(raw) || !id(raw.confirmedExpressionRef) || !integer(raw.draftVersion, 1) || raw.expressionChoice !== 'ORIGINAL' || typeof raw.actorId !== 'string' || typeof raw.nextAction !== 'string') throw invalid()
  return raw as unknown as Receipt
}
export function parseExpression(raw: unknown, version: number): Expression {
  if (!isObject(raw) || !id(raw.confirmedExpressionRef) || !date(raw.expiresAt) || raw.draftVersion !== version) throw invalid()
  return raw as unknown as Expression
}
export async function learningChild(childId: string, manage = false) {
  const child = await findChild(childId)
  if (!child.capabilities.includes(manage ? 'MANAGE' : 'VIEW_SUMMARY')) throw new ApiFailure('CHILD_ACCESS_DENIED', 403)
  return child
}
const query = (cursor?: string, filter?: string) => `?limit=20${cursor ? `&cursor=${uuid(cursor)}` : ''}${filter ? `&status=${encodeURIComponent(filter)}` : ''}`
export async function loadMaterials(childId: string, cursor?: string, filter?: MaterialStatus) {
  const child = await learningChild(childId)
  return { child, ...learningPage(await authenticatedApi(`${childPath(childId)}/learning-material-summaries${query(cursor, filter)}`), childId, material) }
}
export function parseMaterialConfirmation(raw: unknown, childId: string) { return learningPage(raw, childId, material) }
export async function loadSessions(childId: string, cursor?: string, filter?: SessionStatus) {
  const child = await learningChild(childId)
  return { child, ...learningPage(await authenticatedApi(`${childPath(childId)}/learning-sessions${query(cursor, filter)}`), childId, sessionItem) }
}
export async function loadSession(childId: string, sessionId: string) {
  const child = await learningChild(childId)
  return { child, session: parseSession(await authenticatedApi(sessionPath(sessionId)), childId, sessionId) }
}
export async function loadReceipt(childId: string, sessionId: string, slot: number) {
  const { session } = await loadSession(childId, sessionId)
  if (!integer(slot, 1, 5)) throw invalid()
  return parseReceipt(await authenticatedApi(`${sessionPath(sessionId)}/slots/${slot}/receipt`), sessionId, slot, session.planId)
}
function parseSummary(raw: unknown): LearningSummary {
  const metrics = (value: unknown) => Array.isArray(value) && value.every((entry) => isObject(entry) && typeof entry.key === 'string' && integer(entry.count))
  if (!isObject(raw) || !date(raw.periodStart) || !date(raw.periodEnd) || !integer(raw.completedLoops) || !integer(raw.starsEarned) || !metrics(raw.recognitionCounts) || !metrics(raw.assistanceCounts) || typeof raw.metricSnapshotHash !== 'string' || !Array.isArray(raw.limitations) || raw.limitations.some((entry) => typeof entry !== 'string')) throw invalid()
  return raw as unknown as LearningSummary
}
export function periodQuery(from: string, to: string) {
  // Date inputs are inclusive Seoul calendar days; the API end is exclusive.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new ApiFailure('INVALID_PERIOD', 422)
  const start = Date.parse(`${from}T00:00:00+09:00`)
  const end = Date.parse(`${to}T00:00:00+09:00`) + 86_400_000
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * 86_400_000) throw new ApiFailure('INVALID_PERIOD', 422)
  return `?from=${encodeURIComponent(new Date(start).toISOString())}&to=${encodeURIComponent(new Date(end).toISOString())}`
}
export async function loadRecords(childId: string, cursor: string | undefined, period: string) {
  const child = await learningChild(childId)
  const [records, summary] = await Promise.all([authenticatedApi(`${childPath(childId)}/learning-records${query(cursor)}`), authenticatedApi(`${childPath(childId)}/learning-summary${period}`)])
  return { child, ...learningPage(records, childId, result), summary: parseSummary(summary) }
}
export function needsLearningReload(error: unknown) { return error instanceof ApiFailure && [403, 404, 409, 410].includes(error.status) }
