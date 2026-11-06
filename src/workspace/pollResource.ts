// GET 상태 조회만 반복합니다. 생성·확정·음성 요청의 재전송은 이 함수가 하지 않습니다.
export async function pollResource<T>({ read, receive, pending, signal, interval = 2000 }: {
  read: () => Promise<T>; receive: (value: T) => void | Promise<void>
  pending: (value: T) => boolean; signal: AbortSignal; interval?: number
}) {
  while (!signal.aborted) {
    const value = await read()
    if (signal.aborted) return
    await receive(value)
    if (signal.aborted || !pending(value)) return
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort',finish); resolve() }
      const timer = setTimeout(finish,interval)
      signal.addEventListener('abort',finish,{once:true})
      if (signal.aborted) finish()
    })
  }
}
