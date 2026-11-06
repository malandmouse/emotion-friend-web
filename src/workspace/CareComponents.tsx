import { Card, Icon } from '../components/ui'
import type { DayPreviewItem } from './prototypeContracts'

import { placeNames } from './careLabels'


export function WorkflowSteps({ current = 0, labels = ['아동 설정', '최근 경험', '이야기 제작', 'iPad 학습'] }: { current?: number; labels?: string[] }) {
  return <ol className="care-workflow" aria-label="학습 준비 순서">{labels.map((label, index) => <li key={label} className={index === current ? 'is-current' : index < current ? 'is-past' : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? <Icon name="check" size={14} /> : `0${index + 1}`}</span>{label}</li>)}</ol>
}

export function StoryPreviewCard({ story }: { story: DayPreviewItem }) {
  return <Card className="care-story-card"><div className={`care-story-art care-story-art--${story.place}`} aria-hidden="true"><span className="care-story-orbit" /><span className="care-story-number">0{story.slot}</span><Icon name={story.place === 'Home' ? 'home' : story.place === 'School' || story.place === 'Class' ? 'book-plus' : 'calendar'} size={42} /></div><div className="care-story-copy"><div className="care-story-tags"><span>{story.npcId === 'JungHoon' ? '준과 이야기' : '나래와 이야기'}</span><span>{placeNames[story.place] ?? story.place}</span></div><h2>{story.title}</h2><p>{story.summary}</p></div></Card>
}
