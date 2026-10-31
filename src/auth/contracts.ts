import { ApiFailure, isObject } from '../api/client'

export type RequestedRole = 'GUARDIAN' | 'THERAPIST'
export interface Member {
  id: string
  email: string
  displayName: string
  requestedRole: RequestedRole | null
  role: RequestedRole | 'ADMIN' | null
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'
  emailVerified: boolean
  createdAt: string
}
export interface Credentials {
  credential: { accessToken: string; expiresAt: string }
  refreshToken: string
}
export interface SignupInput { email: string; displayName: string; password: string; requestedRole: RequestedRole }

export function parseCredentials(data: unknown): Credentials {
  if (!isObject(data) || !isObject(data.credential) || typeof data.credential.accessToken !== 'string' || !data.credential.accessToken || typeof data.credential.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.credential.expiresAt)) || Date.parse(data.credential.expiresAt) <= Date.now() || typeof data.refreshToken !== 'string' || !data.refreshToken) throw new ApiFailure('INVALID_RESPONSE')
  return data as unknown as Credentials
}
export function parseMember(data: unknown): Member {
  if (!isObject(data) || typeof data.id !== 'string' || typeof data.email !== 'string' || typeof data.displayName !== 'string' || !(data.requestedRole === null || ['GUARDIAN', 'THERAPIST'].includes(String(data.requestedRole))) || !(data.role === null || ['GUARDIAN', 'THERAPIST', 'ADMIN'].includes(String(data.role))) || !['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'].includes(String(data.status)) || typeof data.emailVerified !== 'boolean' || typeof data.createdAt !== 'string') throw new ApiFailure('INVALID_RESPONSE')
  return data as unknown as Member
}
