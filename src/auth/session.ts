import { ApiFailure, isObject, requestApi } from '../api/client'
import type { ApiOptions } from '../api/client'
import { parseCredentials, parseMember } from './contracts'
import type { Credentials, Member, SignupInput } from './contracts'

const STORAGE_KEY = 'emotion-friend.auth.v1'
const LOCK_NAME = 'emotion-friend.auth.session'
interface SavedSession { version: 1; key: string; refreshToken: string }
interface Session extends SavedSession { accessToken: string; expiresAt: number; persistent: boolean }
export interface AuthState { status: 'loading' | 'anonymous' | 'authenticated' | 'error'; member: Member | null; error: ApiFailure | null }

let session: Session | null = null
let state: AuthState = { status: 'loading', member: null, error: null }
const listeners = new Set<() => void>()
let initialized: Promise<void> | undefined
let refreshing: Promise<Session> | undefined
let loadingMember: Promise<Member> | undefined
let loadingMemberKey: string | undefined
let localQueue: Promise<unknown> = Promise.resolve()

export function subscribeAuth(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function getAuthState() { return state }
function publish(next: AuthState) { state = next; listeners.forEach((listener) => listener()) }

function readSaved(): SavedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (isObject(value) && value.version === 1 && typeof value.key === 'string' && typeof value.refreshToken === 'string' && value.refreshToken) return value as unknown as SavedSession
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* Storage disabled: only in-memory login is available. */ }
  return null
}

function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  // Web Locks also serialize refreshes between tabs sharing the persistent session.
  if (navigator.locks) return navigator.locks.request(LOCK_NAME, action)
  const next = localQueue.then(action, action)
  localQueue = next.then(() => undefined, () => undefined)
  return next
}

function clearSession(error: ApiFailure | null = null) {
  if (session?.persistent && readSaved()?.key === session.key) {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* In-memory credentials still clear. */ }
  }
  session = null
  publish({ status: 'anonymous', member: null, error })
}

function saveCredentials(credentials: Credentials, key: string, persistent: boolean): Session {
  const next: Session = { version: 1, key, persistent, accessToken: credentials.credential.accessToken, expiresAt: Date.parse(credentials.credential.expiresAt), refreshToken: credentials.refreshToken }
  if (persistent) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, key, refreshToken: next.refreshToken })) }
    catch { throw new ApiFailure('STORAGE_UNAVAILABLE') }
  }
  session = next
  return next
}

async function refreshLocked(): Promise<Session> {
  if (!session) throw new ApiFailure('SESSION_EXPIRED', 401)
  const current = session
  if (current.persistent) {
    const latest = readSaved()
    if (!latest || latest.key !== current.key) { clearSession(new ApiFailure('SESSION_CHANGED')); throw new ApiFailure('SESSION_CHANGED', 401) }
    current.refreshToken = latest.refreshToken
  }
  try {
    // No Bearer, idempotency key, automatic retry or reuse after an uncertain response.
    const credentials = parseCredentials(await requestApi('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } }))
    return saveCredentials(credentials, current.key, current.persistent)
  } catch {
    const failure = new ApiFailure('SESSION_EXPIRED', 401)
    clearSession(failure)
    throw failure
  }
}

function refresh(): Promise<Session> {
  if (!refreshing) {
    refreshing = withSessionLock(refreshLocked).finally(() => { refreshing = undefined })
  }
  return refreshing
}

/** GET may recover once from expiry; writes are never automatically replayed. */
export async function authenticatedApi(path: string, options: Omit<ApiOptions, 'accessToken'> & { credentialCheck?: boolean } = {}): Promise<unknown> {
  if (!session) throw new ApiFailure('SESSION_EXPIRED', 401)
  const key = session.key
  let current = session
  if (current.expiresAt <= Date.now() + 15_000) current = await refresh()
  const { credentialCheck = false, ...request } = options
  try {
    const result = await requestApi(path, { ...request, accessToken: current.accessToken })
    if (session?.key !== key) throw new ApiFailure('SESSION_CHANGED', 401)
    return result
  } catch (error) {
    if (session?.key !== key) throw new ApiFailure('SESSION_CHANGED', 401)
    if (!(error instanceof ApiFailure) || error.status !== 401 || credentialCheck) throw error
    if (request.method && request.method !== 'GET') { clearSession(error); throw error }
    const next = session.accessToken !== current.accessToken ? session : await refresh()
    try {
      const result = await requestApi(path, { ...request, accessToken: next.accessToken })
      if (session?.key !== key) throw new ApiFailure('SESSION_CHANGED', 401)
      return result
    } catch (retryError) {
      if (session?.key === key && retryError instanceof ApiFailure && retryError.status === 401) clearSession(retryError)
      throw retryError
    }
  }
}

async function currentMember(): Promise<Member> {
  if (!session) throw new ApiFailure('SESSION_EXPIRED', 401)
  const key = session.key
  let current = session
  let refreshed = false
  if (current.expiresAt <= Date.now() + 15_000) { current = await refresh(); refreshed = true }
  try { return parseMember(await requestApi('/me', { accessToken: current.accessToken })) }
  catch (error) {
    if (session?.key !== key) throw new ApiFailure('SESSION_CHANGED', 401)
    if (!(error instanceof ApiFailure) || error.status !== 401) throw error
    if (refreshed) { clearSession(error); throw error }
    current = await refresh()
    try { return parseMember(await requestApi('/me', { accessToken: current.accessToken })) }
    catch (retryError) {
      if (session?.key === key && retryError instanceof ApiFailure && retryError.status === 401) clearSession(retryError)
      throw retryError
    }
  }
}

export async function reloadMember(): Promise<Member> {
  const key = session?.key
  if (!loadingMember || loadingMemberKey !== key) {
    loadingMemberKey = key
    const operation = currentMember().then((member) => {
      if (!session || session.key !== key) throw new ApiFailure('SESSION_CHANGED', 401)
      publish({ status: 'authenticated', member, error: null })
      return member
    }).catch((error: unknown) => {
      const failure = error instanceof ApiFailure ? error : new ApiFailure('NETWORK_ERROR')
      if (session?.key === key) publish({ status: 'error', member: null, error: failure })
      else if (!session) publish({ status: 'anonymous', member: null, error: failure })
      throw failure
    }).finally(() => { if (loadingMember === operation) { loadingMember = undefined; loadingMemberKey = undefined } })
    loadingMember = operation
  }
  return loadingMember
}

export function initializeAuth(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      const saved = readSaved()
      if (!saved || !navigator.locks) { publish({ status: 'anonymous', member: null, error: null }); return }
      session = { ...saved, accessToken: '', expiresAt: 0, persistent: true }
      try { await reloadMember() } catch { /* reloadMember publishes the recovery state. */ }
    })()
  }
  return initialized
}

export async function signup(input: SignupInput): Promise<Member> {
  return parseMember(await requestApi('/auth/signup', { method: 'POST', body: input, expectedStatus: 201 }))
}

export async function login(email: string, password: string, remember: boolean): Promise<Member> {
  await initializeAuth()
  await withSessionLock(async () => {
    if (remember) {
      if (!navigator.locks) throw new ApiFailure('STORAGE_UNAVAILABLE')
      try { const probe = `${STORAGE_KEY}.probe`; localStorage.setItem(probe, '1'); localStorage.removeItem(probe) }
      catch { throw new ApiFailure('STORAGE_UNAVAILABLE') }
    }
    const credentials = parseCredentials(await requestApi('/auth/login', { method: 'POST', body: { loginId: email, password } }))
    // A new login replaces this browser's selected persistent session, without ending other server sessions.
    if (readSaved()) localStorage.removeItem(STORAGE_KEY)
    saveCredentials(credentials, crypto.randomUUID(), remember)
  })
  return reloadMember()
}

export async function logout(): Promise<void> {
  await withSessionLock(async () => {
    if (!session) { clearSession(); return }
    try {
      let current = session
      if (current.expiresAt <= Date.now() + 15_000) current = await refreshLocked()
      if (current.persistent) {
        const latest = readSaved()
        if (!latest || latest.key !== current.key) { clearSession(); return }
        current.refreshToken = latest.refreshToken
      }
      await requestApi('/auth/logout', { method: 'POST', accessToken: current.accessToken, body: { refreshToken: current.refreshToken }, expectedStatus: 204 })
      clearSession()
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) { clearSession(); return }
      // Keep the session so a failed server logout can be explicitly retried.
      throw error
    }
  })
}

window.addEventListener('storage', (event) => {
  if ((event.key !== STORAGE_KEY && event.key !== null) || !session?.persistent) return
  const latest = readSaved()
  if (!latest || latest.key !== session.key) {
    session = null
    publish({ status: 'anonymous', member: null, error: new ApiFailure('SESSION_CHANGED') })
  } else { session = { ...session, refreshToken: latest.refreshToken } }
})
