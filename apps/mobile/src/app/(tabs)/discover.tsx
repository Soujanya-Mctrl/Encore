import Ionicons from '@expo/vector-icons/Ionicons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { originLabel, tracks } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'
import { getListenerPreferences } from '@/features/encore/onboarding/preferences'

const filters = ['All', 'Human-created', 'AI-assisted', 'AI-generated', 'Origin unknown']

export default function Discover() {
  const [filter, setFilter] = useState('All')
  const { width } = useWindowDimensions()
  const cardWidth = (width - 44) / 2
  const selectedStyles = getListenerPreferences().musicStyles
  const shown = tracks.filter((track) => filter === 'All' || originLabel(track.origin) === filter).sort((a, b) => Number(selectedStyles.includes(b.genre)) - Number(selectedStyles.includes(a.genre)))
  const spotlight = tracks[1]
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 32, gap: 26 }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: c.berry, fontSize: 28, fontWeight: '800' }}>Encore</Text>
        <Text style={{ color: c.border, fontSize: 25 }}>/</Text>
        <Text style={{ color: c.ink, fontSize: 24, fontWeight: '700', flex: 1 }}>Discover</Text>
        <Link href="/profile" asChild>
          <Pressable accessibilityLabel="Open profile" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.oat, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-outline" size={22} color={c.ink} />
          </Pressable>
        </Link>
      </View>
      <View style={{ gap: 5 }}>
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>LISTEN WITH CONTEXT</Text>
        <Text style={{ color: c.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 }}>Discover</Text>
      </View>
      <Link href="/search" asChild>
        <Pressable style={{ backgroundColor: c.white, borderRadius: 28, borderWidth: 1, borderColor: c.border, minHeight: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="search-outline" size={20} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 15 }}>Artists, songs, or provenance...</Text>
        </Pressable>
      </Link>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {filters.map((item) => {
        const isSelected = filter === item
        return (
          <Pressable key={item} onPress={() => setFilter(item)} accessibilityRole="button" accessibilityState={{ selected: isSelected }} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 20, backgroundColor: isSelected ? c.berry : c.oat, borderWidth: 1, borderColor: isSelected ? c.berry : c.border }}>
            <Text style={{ color: isSelected ? c.berryDark : c.muted, fontWeight: isSelected ? '700' : '600', fontSize: 14 }}>{item}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
    <View style={{ paddingHorizontal: 16, gap: 14 }}>
      <Text style={{ color: c.ink, fontSize: 22, fontWeight: '700' }}>Featured spotlight</Text>
      <Link href={`/track/${spotlight.id}`} asChild>
        <Pressable style={{ height: 270, borderRadius: 20, overflow: 'hidden', backgroundColor: spotlight.color, borderWidth: 1, borderColor: c.border }}>
          <AlbumArt track={spotlight} size="100%" radius={20} />
          <View style={{ position: 'absolute', top: 16, right: 16, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(11, 11, 15, 0.75)', borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.berry, fontSize: 12, fontWeight: '700' }}>AI-assisted</Text>
          </View>
          <View style={{ position: 'absolute', left: 18, right: 18, bottom: 17, gap: 2 }}>
            <Text style={{ color: c.lavender, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>FEATURED SPOTLIGHT</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 27, fontWeight: '800' }}>{spotlight.title}</Text>
            <Text style={{ color: '#D4D4D8', fontSize: 15 }}>{spotlight.artist} · {spotlight.genre}</Text>
          </View>
        </Pressable>
      </Link>
    </View>
    <View style={{ paddingHorizontal: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: c.ink, fontSize: 23, fontWeight: '700' }}>Made for you</Text>
        <Link href="/search" asChild>
          <Pressable>
            <Text style={{ color: c.berry, fontWeight: '700' }}>See all</Text>
          </Pressable>
        </Link>
      </View>
      {selectedStyles.length > 0 && <Text style={{ color: c.muted, fontSize: 12 }}>Your styles: {selectedStyles.slice(0, 3).join(', ')}{selectedStyles.length > 3 ? ' + more' : ''}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {shown.map((track) => (
          <Link href={`/track/${track.id}`} key={track.id} asChild>
            <Pressable style={{ width: cardWidth, gap: 6 }}>
              <View style={{ width: cardWidth, height: cardWidth, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
                <AlbumArt track={track} size={cardWidth} radius={18} />
                <View style={{ position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(11, 11, 15, 0.8)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ color: track.origin === 'UNKNOWN' ? c.muted : c.berry, fontSize: 10, fontWeight: '700' }}>{originLabel(track.origin)}</Text>
                </View>
              </View>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{track.title}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>{track.artist}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
      {shown.length === 0 && <Text style={{ color: c.muted }}>No tracks match this origin.</Text>}
    </View>
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <Text style={{ color: c.ink, fontSize: 23, fontWeight: '700' }}>Recently explored</Text>
      {tracks.slice(0, 2).map((track) => (
        <Link href={`/track/${track.id}`} key={track.id} asChild>
          <Pressable style={{ minHeight: 72, backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AlbumArt track={track} size={50} radius={12} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>{track.title}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{track.artist} · {track.genre}</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 13 }}>{track.duration}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
    <Text style={{ color: c.muted, fontSize: 12, paddingHorizontal: 16 }}>Sample catalog · artwork is illustrative</Text>
  </ScrollView>
}
