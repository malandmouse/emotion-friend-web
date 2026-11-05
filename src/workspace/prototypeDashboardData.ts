import { authenticatedApi } from '../auth/session'
import { ApiFailure } from '../api/client'
import { childPath } from './api'
import { object } from './contracts'
import { isPrototypeDay } from './prototypeContracts'

export interface LearningDayReport {localDate:string;programDay:number;completedCount:number;stars:number;slots:{slot:number;title:string;status:string}[];recognition:{validFirstResponses:number|null;correctFirstResponses:number|null;replayUsed:number|null};expression:{originalCount:number;aiComposedCount:number};limitations:string[];nextTraining:{priorityGoals:string[];explanationHint:string}|null}
export async function loadPrototypeDay(id: string, date: string, signal: AbortSignal) {
  const today = await authenticatedApi(`${childPath(id)}/day-status${date ? `?localDate=${encodeURIComponent(date)}` : ''}`, { signal })
  if (!isPrototypeDay(today, id)) throw new ApiFailure('INVALID_RESPONSE')
  if (!today.jobId) return { day: today, report: null }
  const report = object<LearningDayReport>(await authenticatedApi(`${childPath(id)}/prototype-dashboard?localDate=${today.localDate}`, { signal }))
  if (report.localDate !== today.localDate) throw new ApiFailure('INVALID_RESPONSE')
  return { day: today, report }
}
