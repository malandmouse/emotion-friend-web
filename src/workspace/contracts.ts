import { ApiFailure, isObject } from '../api/client'
import type { Member } from '../auth/contracts'

export const roleLabels = { GUARDIAN: '보호자', THERAPIST: '치료사', ADMIN: '운영자' }
export const statusLabels = { PENDING: '승인 대기', ACTIVE: '활성', REJECTED: '반려', SUSPENDED: '이용 정지' }
export const capabilityLabels: Record<string, string> = { MANAGE: '동의·연결 관리', VIEW_PROFILE: '프로필 보기', EDIT_PROFILE: '프로필 수정', VIEW_SUMMARY: '학습 요약 보기', CONTENT_REVIEW: '콘텐츠 검토' }
export const consentLabels: Record<ConsentScope, string> = {
  CORE_PROFILE_LEARNING: '기본 프로필·학습 및 치료사 조회', SPEECH_STT: '음성을 글자로 바꾸기', CARD_EXTERNAL_PROCESSING: '표현 카드 외부 처리', CAMERA_LOCAL: '기기 내 카메라 사용', OPTIONAL_RESEARCH_OR_MODEL_TRAINING: '선택 연구·모델 학습', LOCAL_DRAFT_RESUME: '기기 내 임시 입력 복원',
}
export type ConsentScope = 'CORE_PROFILE_LEARNING' | 'SPEECH_STT' | 'CARD_EXTERNAL_PROCESSING' | 'CAMERA_LOCAL' | 'OPTIONAL_RESEARCH_OR_MODEL_TRAINING' | 'LOCAL_DRAFT_RESUME'
export interface ChildSummary { childId: string; pseudonym: string; profileVersion: number; capabilities: string[] }
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface ProfileInput {
  schemaVersion: '0.3.0'; gender: 'BOY' | 'GIRL'; ageBand: 'ELEMENTARY_MIDDLE' | 'TARGET_8_TO_13'; primaryLanguage: 'ko'; receptiveSupport: 'UNKNOWN'; recognitionSupport: 'UNKNOWN' | 'WITH_PICTURES'; expressiveSupport: 'UNKNOWN' | 'SHORT_SENTENCES'; communicationModes: string[]; supportPreferences: string[];
  interests?: string[]; preferredActivities?: string[]; sensoryPreferences?: string[]; avoidTopics?: string[]; recentExperienceRef?: string
}
export interface Profile extends ProfileInput { childId: string; profileVersion: number; createdAt: string }
export interface Consent { consentId: string; childId: string; scope: ConsentScope; granted: boolean; noticeVersion: string; guardianVerificationRef: string; recordedAt: string; withdrawnAt: string | null; revision: number }
export interface Notice { scope: ConsentScope; noticeVersion: string; purpose: string; defaultGranted: boolean }
export interface SentInvitation { invitationId: string; therapistEmail: string; state: string; createdAt: string; expiresAt: string }
export interface InboxInvitation { invitationId: string; guardianDisplayName: string; guardianContact: string; createdAt: string; expiresAt: string; capabilities: string[] }
export interface Therapist { therapistId: string; displayName: string; acceptedAt: string; capabilities: string[] }
export function isActive(member: Member | null) { return !!member && member.status === 'ACTIVE' && member.emailVerified && member.role !== null }
export function uuid(value: string) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiFailure('RESOURCE_NOT_FOUND', 404); return value }
export function items<T>(value: unknown): T[] { if (!isObject(value) || !Array.isArray(value.items)) throw new ApiFailure('INVALID_RESPONSE'); return value.items as T[] }
export function page<T>(value: unknown): Page<T> { if (!isObject(value) || !(value.nextCursor === null || typeof value.nextCursor === 'string')) throw new ApiFailure('INVALID_RESPONSE'); return { items: items<T>(value), nextCursor: value.nextCursor as string | null } }
export function object<T>(value: unknown): T { if (!isObject(value)) throw new ApiFailure('INVALID_RESPONSE'); return value as T }
export function workspaceError(error: unknown): string {
  if (!(error instanceof ApiFailure)) return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  const messages: Record<string, string> = {
    REVIEW_SELECTION_REQUIRED: '검토할 주제·요약을 1~5개 선택해 주세요.', MATERIAL_NOT_READY: '발행된 학습 자료가 아직 준비되지 않았습니다. 요약 확인만으로 자료가 발행되지는 않습니다.', STALE_DRAFT: '요약 버전이 변경되었거나 입력 확정 참조가 만료되었습니다. 최신 상태를 조회하고, 입력은 더 큰 버전으로 다시 확정해 주세요.', STALE_CHECKPOINT: '세션 진행 상태가 변경되었습니다. 현재 완료·receipt를 확인한 뒤 다시 진행해 주세요.', STALE_WORLD_STATE: '이야기 상태가 변경되었습니다. 세션과 완료 receipt를 다시 확인해 주세요.', INVALID_BRANCH_PATH: '실행에서 선택한 경로·장면·감정 식별자가 발행된 자료와 일치하는지 확인해 주세요.', CONTENT_HASH_MISMATCH: '학습 자료 버전 검증에 실패했습니다. 최신 세션 상태를 확인해 주세요.', REWARD_WINDOW_EXPIRED: '이 세션의 보상 날짜가 지났습니다. 신규 완료는 저장할 수 없지만 기존 receipt는 조회할 수 있어요. 복습 실행은 별도 연동이 필요합니다.', EXPRESSION_EXPIRED: '입력 확정 참조가 만료되었습니다. 입력을 더 큰 버전으로 다시 확정해 주세요.', INVALID_PERIOD: '시작일과 종료일을 확인해 주세요. 시작일부터 종료일까지 최대 366일을 선택할 수 있습니다.',
    AUTH_REQUIRED: '비밀번호를 확인해 주세요.', ROLE_FORBIDDEN: '현재 계정 역할로 사용할 수 없는 기능입니다.', ACCOUNT_NOT_ACTIVE: '승인 상태가 변경되었습니다. 내 계정에서 상태를 확인해 주세요.', CHILD_ACCESS_DENIED: '이 아동에 대한 작업 권한이 없습니다.', RESOURCE_NOT_FOUND: '대상이 없거나 더 이상 접근할 수 없습니다.', RESOURCE_DELETED: '더 이상 사용할 수 없는 대상입니다.', CONSENT_REQUIRED: '기본 프로필·학습 동의가 필요합니다. 관리 보호자에게 확인해 주세요.', REAUTH_REQUIRED: '최근 비밀번호 확인이 필요합니다. 현재 상태를 확인한 뒤 다시 진행해 주세요.', VERIFICATION_INVALID: '확인 정보가 만료되었거나 올바르지 않습니다. 받은 안내를 확인해 주세요.', MEMBER_STATE_CONFLICT: '회원 상태가 변경되었거나 관리 중인 아동이 있어 요청을 처리할 수 없습니다. 최신 목록을 확인해 주세요.', INVITATION_STATE_CONFLICT: '초대가 만료되었거나 이미 처리되었습니다. 목록을 새로 확인해 주세요.', RESOURCE_STATE_CONFLICT: '다른 곳에서 프로필이 변경되었습니다. 최신 프로필을 확인한 뒤 다시 수정해 주세요.', CONSENT_NOTICE_CHANGED: '동의 안내가 변경되었습니다. 최신 안내를 확인한 뒤 다시 선택해 주세요.', IDEMPOTENCY_CONFLICT: '이전 요청과 내용이 다릅니다. 현재 결과를 먼저 확인해 주세요.', INVALID_SCHEMA: '입력 형식과 필수 항목을 확인해 주세요.', RATE_LIMITED: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  }
  if (error.code === 'RESOURCE_STATE_CONFLICT') return '대상 상태가 변경되었거나 다른 기기에서 세션을 사용하고 있습니다. 최신 상태를 확인한 뒤 다시 진행해 주세요.'
  return messages[error.code] || (error.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT' || error.status >= 500 ? '서버 응답을 확인하지 못했습니다. 연결 상태를 확인해 주세요.' : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
}
export function formatTime(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '확인 필요' }
