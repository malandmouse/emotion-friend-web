interface PendingVerification { verificationId: string; token: string; receivedAt: number }
const KEY = 'emotion-friend.email-verification.v1'
let memory: PendingVerification | null = null

function valid(value: unknown): value is PendingVerification {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PendingVerification>
  return typeof candidate.verificationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.verificationId)
    && typeof candidate.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(candidate.token)
    && typeof candidate.receivedAt === 'number' && Number.isFinite(candidate.receivedAt)
    && candidate.receivedAt <= Date.now() + 60_000 && Date.now() - candidate.receivedAt < 900_000
}

export function clearEmailVerification() {
  memory = null
  try { sessionStorage.removeItem(KEY) } catch { /* Memory-only operation when storage is unavailable. */ }
}

export function pendingEmailVerification(): PendingVerification | null {
  if (valid(memory)) return memory
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const candidate: unknown = JSON.parse(raw)
      if (valid(candidate)) { memory = candidate; return candidate }
    }
  } catch { /* Invalid/unavailable storage does not expose the secret. */ }
  clearEmailVerification()
  return null
}

/** Capture only a fragment link, then remove its secrets before the app renders. */
export function captureEmailVerificationLink() {
  if (!window.location.hash.startsWith('#/verify-email?')) return
  const hash = window.location.hash
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/verify-email`)
  clearEmailVerification()
  if (hash.length > 1024) return
  const values = new URLSearchParams(hash.slice(hash.indexOf('?') + 1))
  if (values.getAll('verificationId').length !== 1 || values.getAll('token').length !== 1) return
  const candidate = { verificationId: values.get('verificationId'), token: values.get('token'), receivedAt: Date.now() }
  if (!valid(candidate)) return
  memory = candidate
  try { sessionStorage.setItem(KEY, JSON.stringify(candidate)) } catch { /* Keep the current SPA flow in memory. */ }
}

export function postLoginHash() { return pendingEmailVerification() ? '/verify-email' : '/account' }
