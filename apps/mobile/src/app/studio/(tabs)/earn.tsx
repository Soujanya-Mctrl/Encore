import Ionicons from '@expo/vector-icons/Ionicons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  studioColors as c,
  studioEarnings,
  studioPassSeries,
  studioReleases,
  studioTransactions,
} from '@/features/studio/data'
import { SectionTitle, StudioCard, StudioCover, StudioPage } from '@/features/studio/ui'

const filters = ['All', 'Tips', 'Passes'] as const

export default function Earn() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const visibleTransactions = studioTransactions.filter(
    (item) =>
      filter === 'All' ||
      (filter === 'Tips' && item.type === 'Tip') ||
      (filter === 'Passes' && item.type === 'Pass sale'),
  )
  const passRelease = studioReleases.find((item) => item.id === 'echoes')!
  return (
    <StudioPage title="Earn">
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: c.ink, fontSize: 30, fontWeight: '800', flex: 1 }}>Earn</Text>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 9,
              paddingVertical: 5,
              backgroundColor: c.oat,
            }}
          >
            <Text style={{ color: c.berry, fontSize: 11, fontWeight: '700' }}>● Solana Devnet</Text>
          </View>
        </View>
        <Text style={{ color: c.muted, lineHeight: 20 }}>
          Sample artist revenue in test USDC. No payout balance is connected.
        </Text>
      </View>
      <StudioCard>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: c.muted, fontSize: 12, fontWeight: '700' }}>DEMO CONFIRMED EARNINGS</Text>
          <Ionicons name="wallet-outline" size={21} color={c.berry} />
        </View>
        <Text style={{ color: c.ink, fontSize: 38, fontWeight: '800' }}>
          {studioEarnings.confirmed.toFixed(2)} <Text style={{ color: c.berry, fontSize: 17 }}>test USDC</Text>
        </Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>Illustrative total on Devnet</Text>
        <View style={{ height: 1, backgroundColor: c.border }} />
        <View style={{ flexDirection: 'row', gap: 7 }}>
          <Breakdown label="Direct tips" amount={studioEarnings.tips} icon="heart-outline" />
          <Breakdown label="Primary passes" amount={studioEarnings.primaryPasses} icon="ticket-outline" />
          <Breakdown label="Resale proceeds" amount={studioEarnings.resaleProceeds} icon="repeat-outline" />
        </View>
      </StudioCard>
      <View
        style={{
          backgroundColor: c.card,
          borderColor: '#5B4520',
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <Ionicons name="time-outline" size={21} color="#F2BD4B" />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: '#F2BD4B', fontWeight: '800' }}>
            Pending · {studioEarnings.pending.toFixed(2)} test USDC
          </Text>
          <Text style={{ color: c.muted, lineHeight: 19 }}>
            Sample pending activity is separate from confirmed earnings.
          </Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Active pass series" />
        <StudioCard>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <StudioCover release={passRelease} size={58} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.berry, fontSize: 11, fontWeight: '800' }}>
                {studioPassSeries.edition.toUpperCase()} · DEMO
              </Text>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '800' }}>{studioPassSeries.title}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {studioPassSeries.claimed}/{studioPassSeries.supply} claimed · {studioPassSeries.price} test USDC
              </Text>
            </View>
          </View>
          <View style={{ height: 6, backgroundColor: c.oat, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(studioPassSeries.claimed / studioPassSeries.supply) * 100}%`,
                height: 6,
                borderRadius: 4,
                backgroundColor: c.berry,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: c.berry, fontWeight: '700', fontSize: 12 }}>
              {Math.round((studioPassSeries.claimed / studioPassSeries.supply) * 100)}% claimed
            </Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {studioPassSeries.supply - studioPassSeries.claimed} available
            </Text>
          </View>
        </StudioCard>
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Recent transactions" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item }}
              onPress={() => setFilter(item)}
              style={{
                minHeight: 40,
                borderRadius: 20,
                paddingHorizontal: 15,
                backgroundColor: filter === item ? c.berry : c.oat,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: filter === item ? c.berryDark : c.ink, fontWeight: '700' }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ gap: 8 }}>
          {visibleTransactions.map((item) => (
            <Link href={`/studio/receipt/${item.id}`} key={item.id} asChild>
              <Pressable
                accessibilityRole="button"
                style={{
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 16,
                  padding: 14,
                  minHeight: 76,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: c.oat,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={
                      item.type === 'Tip'
                        ? 'heart-outline'
                        : item.type === 'Pass sale'
                          ? 'ticket-outline'
                          : 'repeat-outline'
                    }
                    size={19}
                    color={c.berry}
                  />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: c.ink, fontWeight: '800' }}>{item.title}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    {item.date} · {item.status}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={{ color: item.status === 'Demo pending' ? c.muted : c.berry, fontWeight: '800' }}>
                    +{item.amount.toFixed(2)}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>test USDC</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
      <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>
        Demo ledger. Explorer receipts appear only for real transaction signatures.
      </Text>
    </StudioPage>
  )
}

function Breakdown({
  label,
  amount,
  icon,
}: {
  label: string
  amount: number
  icon: 'heart-outline' | 'ticket-outline' | 'repeat-outline'
}) {
  return (
    <View style={{ flex: 1, backgroundColor: c.oat, borderRadius: 12, padding: 9, gap: 5 }}>
      <Ionicons name={icon} size={16} color={c.berry} />
      <Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: c.ink, fontWeight: '800' }}>{amount.toFixed(2)}</Text>
    </View>
  )
}
