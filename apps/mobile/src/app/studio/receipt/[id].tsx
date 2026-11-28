import { useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Linking, Pressable, Text, View } from 'react-native'
import { studioColors as c, studioTransactions } from '@/features/studio/data'
import { StudioPage, StudioCard } from '@/features/studio/ui'
export default function ReceiptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const item = studioTransactions.find((entry) => entry.id === id)
  const explorerUrl =
    item?.signature && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(item.signature)
      ? `https://explorer.solana.com/tx/${item.signature}?cluster=devnet`
      : null
  return (
    <StudioPage title="Transaction detail" back>
      {item ? (
        <StudioCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: c.oat,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.type === 'Tip' ? 'heart-outline' : 'ticket-outline'} size={22} color={c.berry} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{item.title}</Text>
              <Text style={{ color: c.muted }}>
                {item.date} · {item.type}
              </Text>
            </View>
          </View>
          <Text style={{ color: item.status.endsWith('pending') ? c.muted : c.berry, fontSize: 29, fontWeight: '800' }}>
            +{item.amount.toFixed(2)} <Text style={{ fontSize: 16 }}>test USDC</Text>
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, gap: 5 }}>
            <Text style={{ color: c.muted, fontSize: 12 }}>STATUS</Text>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{item.status}</Text>
          </View>
          {explorerUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(explorerUrl)}
              style={{
                minHeight: 48,
                backgroundColor: c.berry,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: c.berryDark, fontWeight: '800' }}>View on Solana Explorer ↗</Text>
            </Pressable>
          ) : (
            <Text style={{ color: c.muted, lineHeight: 20 }}>
              Demo entry. No on-chain signature or Explorer receipt is available.
            </Text>
          )}
        </StudioCard>
      ) : (
        <Text style={{ color: c.muted }}>Transaction not found.</Text>
      )}
    </StudioPage>
  )
}
