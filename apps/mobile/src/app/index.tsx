import { Redirect } from 'expo-router'
import { getListenerPreferences } from '@/features/encore/onboarding/preferences'

export default function Index() {
  return <Redirect href={getListenerPreferences().completed ? '/discover' : '/onboarding'} />
}
