import { useEffect, useRef, useState } from 'react'

/** Local UI timing only. This hook never sends a request or persists data. */
export function usePreviewAction() {
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const locked = useRef(false)
  useEffect(() => () => { clearTimeout(timer.current) }, [])
  function run(onComplete: () => void, delay = 900) {
    if (locked.current) return
    locked.current = true
    setPending(true)
    timer.current = setTimeout(() => {
      locked.current = false
      setPending(false)
      onComplete()
    }, delay)
  }
  return { pending, run }
}
