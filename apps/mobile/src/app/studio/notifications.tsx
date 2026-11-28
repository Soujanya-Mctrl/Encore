import { Text } from 'react-native'
import { StudioPage, StudioCard } from '@/features/studio/ui'
import { studioColors as c } from '@/features/studio/data'
export default function Notifications() {
  return (
    <StudioPage title="Notifications" back>
      <StudioCard>
        <Text style={{ color: c.ink, fontSize: 21, fontWeight: '700' }}>No live notifications</Text>
        <Text style={{ color: c.muted }}>
          Release review updates and support activity will appear when artist notifications are connected.
        </Text>
      </StudioCard>
    </StudioPage>
  )
}
