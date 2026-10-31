import type { ReactNode, SVGProps } from 'react'
export type IconName = 'home' | 'people' | 'profile' | 'account' | 'link' | 'book-plus' | 'clipboard-check' | 'inbox' | 'calendar' | 'chart' | 'shield' | 'check' | 'alert' | 'info' | 'arrow' | 'empty' | 'chevron' | 'close'
const paths: Record<IconName, ReactNode> = {
  inbox: <><path d="M3 9l3-6h12l3 6v12H3V9ZM3 9h5l2 4h4l2-4h5" /><path d="M9 6h6" /></>,
  home: <path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-8h4v8" />,
  people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5M3 21h12" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
  account: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M6 19a6 6 0 0 1 12 0" /></>,
  link: <path d="M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2" />,
  'book-plus': <><path d="M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14M12 7v6M9 10h6" /></>,
  'clipboard-check': <><path d="M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" /><rect x="9" y="2" width="6" height="5" rx="1" /><path d="m8 14 3 3 5-6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2M8 18h2" /></>,
  chart: <><path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  empty: <path d="M6 3h9l4 4v14H5V3h1Zm8 0v5h5M9 12h6M9 16h4" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
}
export function Icon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
