export const tracks = [
  { id: 'echoes', title: 'Echoes of Stone', artist: 'Julian Vance', genre: 'Classical', origin: 'HUMAN_CREATED', evidence: 'SELF_DECLARED', rights: 'PREVIEW_ALLOWED', color: '#564472', duration: '4:18' },
  { id: 'cosmic', title: 'Cosmic Resonance', artist: 'Aura Spectra', genre: 'Ambient', origin: 'AI_ASSISTED', evidence: 'UNVERIFIED', rights: 'PREVIEW_ALLOWED', color: '#294966', duration: '3:42' },
  { id: 'neon', title: 'Neon Refraction', artist: 'Cyberia', genre: 'Electronic', origin: 'AI_GENERATED', evidence: 'SELF_DECLARED', rights: 'EXTERNAL_LICENSE_ONLY', color: '#753c62', duration: '3:26' },
  { id: 'solar', title: 'Solar Drift', artist: 'Maya Lin', genre: 'Ambient', origin: 'UNKNOWN', evidence: 'UNVERIFIED', rights: 'RESTRICTED', color: '#a56c58', duration: '3:18' },
] as const

export type Track = (typeof tracks)[number]
export const originLabel = (origin: Track['origin']) => ({ HUMAN_CREATED: 'Human-created', AI_ASSISTED: 'AI-assisted', AI_GENERATED: 'AI-generated', UNKNOWN: 'Origin unknown' })[origin]
