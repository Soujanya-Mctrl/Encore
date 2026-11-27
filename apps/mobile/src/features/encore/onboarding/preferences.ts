import { createMMKV } from 'react-native-mmkv'

export type ListenerPreferences = {
  appLanguage: string
  musicLanguages: string[]
  musicStyles: string[]
  completed: boolean
}

const storage = createMMKV({ id: 'encore-listener-preferences' })
const key = 'preferences-v1'

export function getListenerPreferences(): ListenerPreferences {
  const stored = storage.getString(key)
  if (!stored) return { appLanguage: 'English', musicLanguages: [], musicStyles: [], completed: false }
  try {
    const value = JSON.parse(stored) as Partial<ListenerPreferences>
    return {
      appLanguage: typeof value.appLanguage === 'string' ? value.appLanguage : 'English',
      musicLanguages: Array.isArray(value.musicLanguages) ? value.musicLanguages : [],
      musicStyles: Array.isArray(value.musicStyles) ? value.musicStyles : [],
      completed: value.completed === true,
    }
  } catch {
    return { appLanguage: 'English', musicLanguages: [], musicStyles: [], completed: false }
  }
}

export function saveListenerPreferences(patch: Partial<ListenerPreferences>) {
  storage.set(key, JSON.stringify({ ...getListenerPreferences(), ...patch }))
}
