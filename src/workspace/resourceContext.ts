import { createContext } from 'react'

export const ResourceContext = createContext<{ loading: boolean; reload: () => Promise<void> } | null>(null)
