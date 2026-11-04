import type { ReactNode } from 'react'
import { Badge, Button, ErrorState, LoadingState } from '../components/ui'
import { capabilityLabels, workspaceError } from './contracts'
import { ResourceContext } from './resourceContext'

export function ResourceState({ loading, error, retry, children }: { loading: boolean; error: unknown; retry: () => Promise<void>; children?: ReactNode }) {
  if (error) return <ErrorState description={workspaceError(error)} action={<Button variant="secondary" onClick={() => void retry()}>다시 확인</Button>} />
  return <ResourceContext.Provider value={{ loading, reload: retry }}>
    {loading && <LoadingState />}
    <div className="resource-content" hidden={loading}>{children}</div>
  </ResourceContext.Provider>
}
export function Capabilities({ values }: { values: string[] }) { return <div className="row">{values.map((capability) => <Badge key={capability} tone="info">{capabilityLabels[capability] ?? capability}</Badge>)}</div> }
