import { useCallback, useEffect, useRef, useState } from 'react'

export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ source: typeof load | null; data: T | null; error: unknown; loading: boolean }>({ source: null, data: null, error: null, loading: true })
  const generation = useRef(0)
  const active = useRef(false)
  const read = useCallback(() => {
    const ticket = ++generation.current
    return Promise.resolve().then(load).then(
      (data) => { if (active.current && ticket === generation.current) setState({ source: load, data, loading: false, error: null }) },
      (error: unknown) => { if (active.current && ticket === generation.current) setState({ source: load, data: null, loading: false, error }) },
    )
  }, [load])
  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }))
    return read()
  }, [read])
  useEffect(() => {
    active.current = true
    void read()
    const onFocus = () => { void reload() }
    window.addEventListener('focus', onFocus)
    return () => { active.current = false; generation.current += 1; window.removeEventListener('focus', onFocus) }
  }, [read, reload])
  const current = state.source === load
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current || state.loading, reload }
}
