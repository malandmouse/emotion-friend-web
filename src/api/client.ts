export class ApiFailure extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: number

  constructor(code: string, status = 0, retryAfter?: number) {
    super(code)
    this.name = 'ApiFailure'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
export interface ApiOptions { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; accessToken?: string; expectedStatus?: number | readonly number[]; idempotencyKey?: string; signal?: AbortSignal }

/** Authentication writes are deliberately never retried here. */
export async function requestApi(path: string, options: ApiOptions = {}): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal
  try {
    signal.throwIfAborted()
    const headers = new Headers({ Accept: 'application/json' })
    if (options.body !== undefined) headers.set('Content-Type', 'application/json')
    if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal,
    })
    let data: unknown = null
    if (response.status !== 204) {
      try { data = await response.json() } catch { /* A proxy failure may not be JSON. */ }
    }
    signal.throwIfAborted()
    if (!response.ok) {
      const code = isObject(data) && typeof data.code === 'string' ? data.code : response.status >= 500 ? 'SERVER_UNAVAILABLE' : 'REQUEST_FAILED'
      const retryAfter = Number(response.headers.get('Retry-After'))
      throw new ApiFailure(code, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined)
    }
    const expected = options.expectedStatus ?? 200
    if (!(Array.isArray(expected) ? expected.includes(response.status) : response.status === expected)) throw new ApiFailure('INVALID_RESPONSE')
    return data
  } catch (error) {
    if (options.signal?.aborted) throw new ApiFailure('REQUEST_CANCELLED')
    if (error instanceof ApiFailure) throw error
    throw new ApiFailure(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR')
  } finally { clearTimeout(timer) }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function authErrorMessage(error: unknown, context: 'login' | 'signup' | 'session' | 'logout' = 'session'): string {
  if (!(error instanceof ApiFailure)) return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  switch (error.code) {
    case 'ACCOUNT_ALREADY_EXISTS': return '이미 가입된 이메일 주소입니다. 로그인해 주세요.'
    case 'AUTH_REQUIRED':
    case 'TOKEN_EXPIRED':
    case 'SESSION_EXPIRED': return context === 'login' ? '이메일 주소 또는 비밀번호를 확인해 주세요.' : '로그인 정보가 만료되었거나 더 이상 유효하지 않습니다. 다시 로그인해 주세요.'
    case 'SESSION_CHANGED': return '다른 창에서 로그인 상태가 변경되었습니다. 다시 로그인해 주세요.'
    case 'ACCOUNT_NOT_ACTIVE': return '아직 사용할 수 없는 계정입니다. 내 계정에서 승인 상태를 확인해 주세요.'
    case 'INVALID_SCHEMA': return '입력 내용을 확인해 주세요. 가입 비밀번호는 15~128자이며 이름은 80자 이내입니다.'
    case 'RATE_LIMITED': return error.retryAfter ? `요청이 많습니다. 약 ${Math.ceil(error.retryAfter)}초 후 다시 시도해 주세요.` : '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
    case 'STORAGE_UNAVAILABLE': return '이 브라우저에서 로그인 상태를 저장할 수 없습니다. 로그인 상태 유지를 해제한 뒤 다시 시도해 주세요.'
    case 'INVALID_RESPONSE': return '서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'
    case 'REQUEST_TIMEOUT': return context === 'signup' ? '응답을 기다리는 시간이 길어졌어요. 가입이 완료되었을 수 있으니 로그인으로 확인해 주세요.' : '서버 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
    case 'NETWORK_ERROR':
    case 'SERVER_UNAVAILABLE': return '서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
    default: return context === 'logout' ? '로그아웃을 완료하지 못했어요. 다시 시도해 주세요.' : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  }
}
