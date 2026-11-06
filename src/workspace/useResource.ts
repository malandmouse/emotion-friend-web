import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ source: typeof load | null; data: T | null; error: unknown; loading: boolean }>({ source: null, data: null, error: null, loading: true })
  const active = useRef<AbortController | null>(null)
  const source = useRef<typeof load | null>(null)
  const read = useCallback(() => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    return Promise.resolve().then(() => load(controller.signal)).then(
      (data) => { if (!controller.signal.aborted) setState({ source: load, data, loading: false, error: null }) },
      (error: unknown) => {
        if (controller.signal.aborted) return
        controller.abort()
        setState({ source: load, data: null, loading: false, error })
      },
    )
  }, [load])
  const reload = useCallback(() => {
    if (source.current !== load) return Promise.resolve()
    setState((previous) => ({ ...previous, loading: true, error: null }))
    return read()
  }, [load, read])
  useLayoutEffect(() => {
    source.current = load
    void read()
    const revalidate = () => { void reload() }
    window.addEventListener('focus', revalidate)
    window.addEventListener('online', revalidate)
    return () => {
      source.current = null
      active.current?.abort()
      window.removeEventListener('focus', revalidate)
      window.removeEventListener('online', revalidate)
    }
  }, [load, read, reload])
  const current = state.source === load
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current || state.loading, reload }
}
