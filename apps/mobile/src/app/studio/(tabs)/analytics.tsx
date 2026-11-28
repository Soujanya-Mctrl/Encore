import Ionicons from '@expo/vector-icons/Ionicons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Share, Text, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Stop } from 'react-native-svg'
import { studioColors as c, studioMetrics, studioPatronCities, studioReleases } from '@/features/studio/data'
import { SectionTitle, StudioCard, StudioCover, StudioPage } from '@/features/studio/ui'

const topTracks = studioReleases
  .filter((item) => item.plays !== undefined)
  .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
const points = studioMetrics.trend.map((value, index) => `${index * 27},${116 - value * 0.095}`).join(' ')

export default function Analytics() {
  const [period, setPeriod] = useState<'28 days' | '7 days'>('28 days')
  const defaultPeriod = period === '28 days'
  return (
    <StudioPage title="Analytics">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityLabel="Change analytics date range"
          onPress={() => setPeriod(defaultPeriod ? '7 days' : '28 days')}
          style={{
            flex: 1,
            minHeight: 48,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 24,
            backgroundColor: c.oat,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="calendar-outline" size={20} color={c.berry} />
          <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            Last {period}
            {defaultPeriod ? ` (${studioMetrics.range})` : ''}
          </Text>
          <Ionicons name="chevron-down" size={16} color={c.muted} />
        </Pressable>
        <Pressable
          accessibilityLabel="Share demo analytics"
          onPress={() =>
            void Share.share({
              message: `Encore Studio demo analytics: ${studioMetrics.plays.toLocaleString()} preview plays and ${studioMetrics.listeners.toLocaleString()} listeners over the last 28 days.`,
            })
          }
          style={{
            width: 48,
            height: 48,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 24,
            backgroundColor: c.oat,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="share-outline" size={20} color={c.ink} />
        </Pressable>
      </View>
      {defaultPeriod ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Metric label="Preview plays" value={studioMetrics.plays} change={studioMetrics.playsChange} icon="play" />
            <Metric
              label="Listeners"
              value={studioMetrics.listeners}
              change={studioMetrics.listenersChange}
              icon="people"
            />
          </View>
          <StudioCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="ticket-outline" size={22} color={c.berry} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '800' }}>Supporter conversion</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>Pass unlocks from preview plays</Text>
              </View>
              <Text style={{ color: c.berry, fontSize: 21, fontWeight: '800' }}>{studioMetrics.conversion}%</Text>
            </View>
          </StudioCard>
          <StudioCard>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700' }}>PREVIEW PLAYS TREND</Text>
                <Text style={{ color: c.ink, fontSize: 24, fontWeight: '800' }}>
                  {studioMetrics.plays.toLocaleString()} plays
                </Text>
              </View>
              <Text style={{ color: c.berry, fontSize: 11 }}>● Daily pulse</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 12 }}>Demo activity · {studioMetrics.range}</Text>
            <View style={{ height: 168 }}>
              <Svg width="100%" height="100%" viewBox="0 0 300 150">
                <Defs>
                  <LinearGradient id="studio-area" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor={c.berry} stopOpacity=".22" />
                    <Stop offset="1" stopColor={c.berry} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Line x1="0" y1="116" x2="300" y2="116" stroke={c.border} />
                <Line x1="0" y1="68" x2="300" y2="68" stroke={c.border} strokeDasharray="3 4" />
                <Line x1="0" y1="20" x2="300" y2="20" stroke={c.border} strokeDasharray="3 4" />
                <Path d={`M0 116 L${points.replaceAll(' ', ' L')} L297 116 Z`} fill="url(#studio-area)" />
                <Polyline
                  points={points}
                  fill="none"
                  stroke={c.berry}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <Line x1="216" y1="20" x2="216" y2="116" stroke={c.berry} strokeDasharray="2 4" />
                <Circle
                  cx="216"
                  cy={116 - studioMetrics.trend[8] * 0.095}
                  r="5"
                  fill={c.bg}
                  stroke={c.berry}
                  strokeWidth="3"
                />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {['Oct 30', 'Nov 7', 'Nov 14', 'Nov 21', 'Nov 27'].map((date) => (
                <Text key={date} style={{ color: date === 'Nov 21' ? c.berry : c.muted, fontSize: 11 }}>
                  {date}
                </Text>
              ))}
            </View>
          </StudioCard>
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#12493A',
              backgroundColor: '#0A1B19',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={26} color={c.berry} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.berry, fontWeight: '800' }}>
                Human origin trust · {studioMetrics.humanOriginTrust}%
              </Text>
              <Text style={{ color: c.ink, lineHeight: 20 }}>
                Illustrative share of listeners using human origin or corroborated evidence filters.
              </Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Top tracks" />
            <StudioCard>
              {topTracks.map((release, index) => {
                const share = Math.round(((release.plays ?? 0) / studioMetrics.plays) * 100)
                return (
                  <Link key={release.id} href={`/studio/release/${release.id}`} asChild>
                    <Pressable
                      accessibilityRole="button"
                      style={{
                        paddingVertical: 8,
                        gap: 9,
                        borderBottomWidth: index === topTracks.length - 1 ? 0 : 1,
                        borderBottomColor: c.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ color: index === 0 ? c.berry : c.muted, width: 18, fontWeight: '800' }}>
                          {index + 1}
                        </Text>
                        <StudioCover release={release} size={48} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text numberOfLines={1} style={{ color: c.ink, fontSize: 16, fontWeight: '800' }}>
                            {release.title}
                          </Text>
                          <Text style={{ color: c.muted, fontSize: 12 }}>
                            {release.listeners?.toLocaleString()} listeners · {share}% of plays
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: index === 0 ? c.berry : c.ink, fontSize: 17, fontWeight: '800' }}>
                            {release.plays?.toLocaleString()}
                          </Text>
                          <Text style={{ color: c.muted, fontSize: 11 }}>plays</Text>
                        </View>
                      </View>
                      <View style={{ height: 6, backgroundColor: c.oat, borderRadius: 4, overflow: 'hidden' }}>
                        <View
                          style={{
                            width: `${share}%`,
                            height: 6,
                            borderRadius: 4,
                            backgroundColor: index === 0 ? c.berry : '#789C62',
                          }}
                        />
                      </View>
                    </Pressable>
                  </Link>
                )
              })}
            </StudioCard>
          </View>
          <StudioCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="earth-outline" size={24} color={c.berry} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '800' }}>Top patron cities</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {studioPatronCities.map((city) => `${city.name} (${city.share}%)`).join(', ')} · demo
                </Text>
              </View>
            </View>
          </StudioCard>
        </>
      ) : (
        <StudioCard>
          <Ionicons name="stats-chart-outline" size={28} color={c.berry} />
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>No 7-day analytics yet</Text>
          <Text style={{ color: c.muted, lineHeight: 20 }}>
            This demo dataset contains a 28-day period. Select Last 28 days to see the sample trend.
          </Text>
        </StudioCard>
      )}
    </StudioPage>
  )
}

function Metric({
  label,
  value,
  change,
  icon,
}: {
  label: string
  value: number
  change: number
  icon: 'play' | 'people'
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 14,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: c.muted, flex: 1, fontSize: 12, fontWeight: '700' }}>{label.toUpperCase()}</Text>
        <Ionicons name={icon} size={17} color={c.berry} />
      </View>
      <Text style={{ color: c.ink, fontSize: 27, fontWeight: '800' }}>{value.toLocaleString()}</Text>
      <Text style={{ color: c.berry, fontSize: 12, fontWeight: '800' }}>
        ↗ +{change}% <Text style={{ color: c.muted, fontWeight: '400' }}>vs prior 28d</Text>
      </Text>
    </View>
  )
}
