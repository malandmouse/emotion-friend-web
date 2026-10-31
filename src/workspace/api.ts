import { authenticatedApi } from '../auth/session'
import { ApiFailure, isObject } from '../api/client'
import { items, object, page, uuid } from './contracts'
import type { ChildSummary, Consent, InboxInvitation, Notice, Profile, SentInvitation, Therapist } from './contracts'

export const childPath = (id: string) => `/children/${uuid(id)}`
export const listChildren = async (cursor?: string) => page<ChildSummary>(await authenticatedApi(`/children?limit=100${cursor ? `&cursor=${encodeURIComponent(uuid(cursor))}` : ''}`))
export async function findChild(id: string): Promise<ChildSummary> {
  uuid(id)
  let cursor: string | undefined
  const visited = new Set<string>()
  do {
    const result = await listChildren(cursor)
    const child = result.items.find((value) => value.childId === id)
    if (child) {
      if (!Array.isArray(child.capabilities) || typeof child.pseudonym !== 'string') throw new ApiFailure('INVALID_RESPONSE')
      return child
    }
    cursor = result.nextCursor ?? undefined
    if (cursor && visited.has(cursor)) throw new ApiFailure('INVALID_RESPONSE')
    if (cursor) visited.add(cursor)
  } while (cursor)
  throw new ApiFailure('RESOURCE_NOT_FOUND', 404)
}
export async function loadProfile(id: string) {
  const child = await findChild(id)
  if (!child.capabilities.includes('VIEW_PROFILE')) throw new ApiFailure('CHILD_ACCESS_DENIED', 403)
  const profile = object<Profile>(await authenticatedApi(`${childPath(id)}/profile`))
  if (profile.childId !== id || !Number.isInteger(profile.profileVersion) || !['BOY', 'GIRL'].includes(profile.gender) || !['ELEMENTARY_MIDDLE', 'TARGET_8_TO_13'].includes(profile.ageBand) || profile.primaryLanguage !== 'ko' || !Array.isArray(profile.communicationModes) || !Array.isArray(profile.supportPreferences)) throw new ApiFailure('INVALID_RESPONSE')
  return { child, profile }
}
export async function loadConsents(id: string) {
  const child = await findChild(id)
  if (!child.capabilities.includes('MANAGE')) throw new ApiFailure('CHILD_ACCESS_DENIED', 403)
  const [rawNotices, rawConsents] = await Promise.all([authenticatedApi('/consent-notices'), authenticatedApi(`${childPath(id)}/consents`)])
  if (!Array.isArray(rawNotices) || rawNotices.some((notice) => !isObject(notice) || typeof notice.scope !== 'string' || typeof notice.noticeVersion !== 'string' || typeof notice.purpose !== 'string')) throw new ApiFailure('INVALID_RESPONSE')
  return { child, notices: rawNotices as Notice[], consents: items<Consent>(rawConsents) }
}
export async function loadConnections(id: string) {
  const child = await findChild(id)
  if (!child.capabilities.includes('MANAGE')) throw new ApiFailure('CHILD_ACCESS_DENIED', 403)
  const [sent, connected, consents] = await Promise.all([authenticatedApi(`${childPath(id)}/therapist-invitations`), authenticatedApi(`${childPath(id)}/therapists`), authenticatedApi(`${childPath(id)}/consents`)])
  return { child, invitations: items<SentInvitation>(sent), therapists: items<Therapist>(connected), coreGranted: items<Consent>(consents).some((item) => item.scope === 'CORE_PROFILE_LEARNING' && item.granted) }
}
export const loadInbox = async () => items<InboxInvitation>(await authenticatedApi('/me/therapist-invitations'))
