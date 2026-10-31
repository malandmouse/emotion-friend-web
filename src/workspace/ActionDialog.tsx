import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from '../components/ui'
import { ActionForm } from './ActionForm'
import type { ActionFormProps } from './ActionForm'

interface Props extends Omit<ActionFormProps, 'onLockChange' | 'onCancel'> {
  title: string
  intro?: ReactNode
  onClose: () => void
}

export function ActionDialog({ title, intro, onClose, ...form }: Props) {
  const [locked, setLocked] = useState(false)
  return <Modal title={title} onClose={onClose} closeDisabled={locked}>
    {intro && <div className="section-notice">{intro}</div>}
    <ActionForm {...form} onLockChange={setLocked} onCancel={onClose} />
  </Modal>
}
