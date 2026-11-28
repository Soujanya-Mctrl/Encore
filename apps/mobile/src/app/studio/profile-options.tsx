import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { Text } from 'react-native'
import { StudioPage, StudioCard, StudioButton } from '@/features/studio/ui'
import { studioColors as c } from '@/features/studio/data'
export default function ProfileOptions() {
  const { account } = useMobileWallet()
  return (
    <StudioPage title="Artist profile" back>
      <StudioCard>
        <Text style={{ color: c.ink, fontSize: 21, fontWeight: '700' }}>{account?.label ?? 'Demo artist profile'}</Text>
        <Text style={{ color: c.muted }}>
          {account ? account.address : 'Connect an artist wallet to access live profile data.'}
        </Text>
        <StudioButton title="Open wallet" href="/wallet" secondary />
      </StudioCard>
    </StudioPage>
  )
}
