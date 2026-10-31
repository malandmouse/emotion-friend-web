import type { ReactNode } from 'react'
import { Badge, Button, ErrorState, LoadingState } from '../components/ui'
import { capabilityLabels, workspaceError } from './contracts'

export function ResourceState({ loading, error, retry, children }: { loading: boolean; error: unknown; retry: () => Promise<void>; children?: ReactNode }) {
  if (error) return <ErrorState description={workspaceError(error)} action={<Button variant="secondary" onClick={() => void retry()}>다시 확인</Button>} />
  if (loading && !children) return <LoadingState />
  return <>{children}</>
}
export function Capabilities({ values }: { values: string[] }) { return <div className="row">{values.map((capability) => <Badge key={capability} tone="info">{capabilityLabels[capability] ?? capability}</Badge>)}</div> }
