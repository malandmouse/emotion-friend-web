import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import './modal.css'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
  closeDisabled?: boolean
}

export function Modal({ title, children, onClose, closeDisabled = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const previousPadding = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth}px`
    document.body.style.overflow = 'hidden'
    element.showModal()
    heading.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPadding
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(<dialog ref={dialog} className="modal" aria-labelledby={titleId} aria-modal="true" onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose() }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0 && element.tabIndex >= 0)
    const first = controls[0], last = controls[controls.length - 1]
    if (!first) { event.preventDefault(); heading.current?.focus(); return }
    if (!controls.includes(document.activeElement as HTMLElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus()
    }
  }}>
    <div className="modal__header">
      <h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
      <button type="button" className="modal__close" aria-label="닫기" disabled={closeDisabled} onClick={onClose}><Icon name="close" size={22} /></button>
    </div>
    <div className="modal__body">{children}</div>
  </dialog>, document.body)
}
