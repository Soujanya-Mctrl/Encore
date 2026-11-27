import { useMemo, useState } from 'react'
import { Link } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { originLabel, tracks } from '@/features/encore/fixtures'
import { AlbumArt } from '@/features/encore/ui/album-art'
import { encoreColors as c } from '@/features/encore/ui/tokens'

const filters = ['All', 'Human-created', 'AI-assisted', 'AI-generated', 'Origin unknown']
const categories = [{ label: 'Ambient', icon: 'water-outline' }, { label: 'Neoclassical', icon: 'musical-notes-outline' }, { label: 'Acoustic', icon: 'radio-outline' }, { label: 'Electronic', icon: 'options-outline' }] as const

export default function Search() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const results = useMemo(() => tracks.filter((track) => {
    const matchesFilter = filter === 'All' || originLabel(track.origin) === filter
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const haystack = `${track.title} ${track.artist} ${track.genre} ${originLabel(track.origin)}`.toLowerCase()
    return matchesFilter && terms.every((term) => haystack.includes(term))
  }), [query, filter])

  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 90, gap: 24 }}>
    <Text style={{ color: c.ink, fontSize: 32, fontWeight: '800', marginTop: 12 }}>Search</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 18, backgroundColor: c.white, borderColor: c.border, borderWidth: 1, paddingHorizontal: 16, gap: 12 }}>
      <Ionicons name="search-outline" size={22} color={c.muted} />
      <TextInput accessibilityLabel="Search music" autoCapitalize="none" value={query} onChangeText={setQuery} placeholder="Artists, songs, or provenance..." placeholderTextColor={c.muted} style={{ flex: 1, color: c.ink, fontSize: 16 }} />
      {query.length > 0 && <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={22} color={c.muted} /></Pressable>}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {filters.map((item) => {
        const isSelected = filter === item
        return (
          <Pressable key={item} onPress={() => setFilter(item)} style={{ backgroundColor: isSelected ? c.berry : c.oat, borderWidth: 1, borderColor: isSelected ? c.berry : c.border, borderRadius: 20, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ color: isSelected ? c.berryDark : c.ink, fontWeight: isSelected ? '700' : '600' }}>{item}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
    <View style={{ gap: 12 }}>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1.4 }}>CATEGORIES</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {categories.map((category) => (
          <Pressable key={category.label} onPress={() => setQuery(category.label)} style={{ width: '48%', flexGrow: 1, minHeight: 74, backgroundColor: c.white, borderRadius: 18, borderColor: c.border, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={category.icon} size={23} color={c.berry} />
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{category.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.ink, fontSize: 24, fontWeight: '700' }}>Matched works</Text>
        <Text style={{ color: c.muted }}>{results.length} tracks</Text>
      </View>
      {results.map((track) => (
        <Link href={`/track/${track.id}`} key={track.id} asChild>
          <Pressable style={{ backgroundColor: c.white, borderRadius: 18, borderColor: c.border, borderWidth: 1, padding: 12, minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AlbumArt track={track} size={58} radius={12} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{track.title}</Text>
              <Text style={{ color: c.muted }} numberOfLines={1}>{track.artist}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 5 }}>
              <Text style={{ color: c.berry, fontSize: 11, fontWeight: '700' }}>{originLabel(track.origin)}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{track.duration}</Text>
            </View>
          </Pressable>
        </Link>
      ))}
      {results.length === 0 && <Text style={{ color: c.muted, paddingVertical: 24 }}>No works match your search. Try another artist, genre, or origin.</Text>}
    </View>
    <Text style={{ color: c.muted, fontSize: 12 }}>Sample catalog · search results are local fixtures</Text>
  </ScrollView>
}
