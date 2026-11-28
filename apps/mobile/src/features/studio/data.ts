import { encoreColors } from '@/features/encore/ui/tokens'

export const studioColors = encoreColors

export type ReleaseStatus = 'Published' | 'In review' | 'Draft' | 'Needs evidence' | 'Rights restricted'
export type StudioRelease = {
  id: string
  title: string
  kind: string
  date: string
  status: ReleaseStatus
  origin: string
  evidence: string
  rights: string
  plays?: number
  listeners?: number
  color: string
  note?: string
}

export const studioReleases: StudioRelease[] = [
  {
    id: 'echoes',
    title: 'Echoes of Stone',
    kind: 'Single',
    date: 'Nov 18, 2026',
    status: 'Published',
    origin: 'Human-created',
    evidence: 'Corroborated',
    rights: 'Preview allowed',
    plays: 8920,
    listeners: 2150,
    color: '#564472',
  },
  {
    id: 'true-colors',
    title: 'True Colors',
    kind: 'Single',
    date: 'Nov 4, 2026',
    status: 'Published',
    origin: 'AI-assisted',
    evidence: 'Corroborated',
    rights: 'Preview allowed',
    plays: 4210,
    listeners: 980,
    color: '#A56C58',
  },
  {
    id: 'passage',
    title: 'Passage (Acoustic)',
    kind: 'Single',
    date: 'Oct 22, 2026',
    status: 'Published',
    origin: 'Human-created',
    evidence: 'Self-declared',
    rights: 'Preview allowed',
    plays: 1690,
    listeners: 280,
    color: '#4D6B69',
  },
  {
    id: 'aethereal',
    title: 'Aethereal Drift',
    kind: 'Single',
    date: 'Updated today',
    status: 'Needs evidence',
    origin: 'AI-assisted',
    evidence: 'Self-declared · project upload pending',
    rights: 'Preview allowed · commercial restricted',
    color: '#7D6379',
    note: 'Curator review: provide source DAW stems or a collaborator split agreement.',
  },
  {
    id: 'resonance-vault',
    title: 'Resonance Vault',
    kind: 'EP',
    date: 'Nov 25, 2026',
    status: 'In review',
    origin: 'Unknown',
    evidence: 'Unverified',
    rights: 'Pending review',
    color: '#426178',
  },
  {
    id: 'midnight',
    title: 'Midnight Frequency',
    kind: 'Draft',
    date: 'Edited recently',
    status: 'Draft',
    origin: 'Unknown',
    evidence: 'Unverified',
    rights: 'Declaration missing',
    color: '#554B5B',
  },
]

export const studioMetrics = {
  period: 'Last 28 days',
  range: 'Oct 30 – Nov 27',
  plays: 14820,
  listeners: 3410,
  conversion: 4.8,
  playsChange: 12.4,
  listenersChange: 8.1,
  humanOriginTrust: 68,
  trend: [110, 170, 360, 820, 450, 310, 280, 520, 1000, 510, 400, 360],
} as const

export const studioEarnings = {
  confirmed: 482.5,
  tips: 142.5,
  primaryPasses: 285,
  resaleProceeds: 55,
  pending: 15,
} as const

export const studioPassSeries = {
  title: 'Echoes of Stone Pass Series 1',
  edition: 'Edition 01',
  price: 10,
  claimed: 30,
  supply: 50,
} as const

export const studioPatronCities = [
  { name: 'Berlin', share: 28 },
  { name: 'London', share: 22 },
  { name: 'Tokyo', share: 17 },
] as const
export type StudioTransaction = {
  id: string
  title: string
  type: 'Tip' | 'Pass sale' | 'Resale'
  amount: number
  date: string
  status: 'Demo confirmed' | 'Demo pending' | 'Confirmed' | 'Pending'
  signature?: string
}
export const studioTransactions: StudioTransaction[] = [
  {
    id: 'pass-14',
    title: 'Supporter Pass #14',
    type: 'Pass sale',
    amount: 10,
    date: 'Nov 27',
    status: 'Demo confirmed',
  },
  { id: 'tip-1', title: 'Direct fan tip', type: 'Tip', amount: 25, date: 'Nov 26', status: 'Demo confirmed' },
  {
    id: 'resale-1',
    title: 'Artist resale proceeds',
    type: 'Resale',
    amount: 2,
    date: 'Nov 25',
    status: 'Demo confirmed',
  },
  { id: 'tip-pending', title: 'Direct fan tip', type: 'Tip', amount: 15, date: 'Nov 27', status: 'Demo pending' },
]
