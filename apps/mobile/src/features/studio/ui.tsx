import Ionicons from '@expo/vector-icons/Ionicons'
import { Link, useRouter, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { CreateMusicSheet } from './create-sheet'
import { studioColors as c, type StudioRelease } from './data'

const avatar = require('../../../assets/images/artist-avatar.png')

export function ArtistAvatar({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={avatar}
      accessibilityLabel="Artist portrait"
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: c.border }}
    />
  )
}

export function StudioCover({ release, size = 60 }: { release: StudioRelease; size?: number }) {
  const accent =
    release.id === 'echoes'
      ? '#D4E84C'
      : release.id === 'true-colors'
        ? '#F2B49C'
        : release.id === 'passage'
          ? '#E2AE6E'
          : '#C79EFF'
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(10, size / 6),
        overflow: 'hidden',
        backgroundColor: release.color,
      }}
    >
      {release.status === 'Draft' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="musical-note" size={size * 0.36} color={c.ink} />
        </View>
      ) : (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={`cover-${release.id}`} x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={release.color} />
              <Stop offset="1" stopColor="#0B0B0F" />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" fill={`url(#cover-${release.id})`} />
          <Circle cx="75" cy="24" r="21" fill={accent} opacity=".55" />
          <Path
            d="M-8 83 C 16 42, 40 90, 60 51 S 96 57, 110 18"
            fill="none"
            stroke={accent}
            strokeWidth="11"
            opacity=".74"
          />
          <Path
            d="M-8 96 C 20 54, 39 101, 66 64 S 101 65, 110 37"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            opacity=".48"
          />
        </Svg>
      )}
    </View>
  )
}

export function StudioStatus({ status }: { status: StudioRelease['status'] }) {
  const tone =
    status === 'Published'
      ? '#33D49A'
      : status === 'Needs evidence'
        ? '#F2BD4B'
        : status === 'In review'
          ? c.lavender
          : status === 'Rights restricted'
            ? '#F0849D'
            : c.muted
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: c.oat,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tone }} />
      <Text style={{ color: tone, fontSize: 11, fontWeight: '700' }}>{status}</Text>
    </View>
  )
}

export function StudioPage({
  title,
  back = false,
  onCreate,
  children,
}: {
  title: string
  back?: boolean
  onCreate?: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          accessibilityLabel={back ? 'Go back' : 'Back to Profile'}
          onPress={() => (back && router.canGoBack() ? router.back() : router.replace('/profile'))}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={23} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.berry, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>ENCORE STUDIO</Text>
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Add music files"
          accessibilityRole="button"
          onPress={onCreate ?? (() => setCreateOpen(true))}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 22,
            backgroundColor: c.oat,
          }}
        >
          <Ionicons name="add" size={25} color={c.berry} />
        </Pressable>
        <Link href="/studio/notifications" asChild>
          <Pressable
            accessibilityLabel="Notifications"
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 22,
              backgroundColor: c.oat,
            }}
          >
            <Ionicons name="notifications-outline" size={21} color={c.ink} />
          </Pressable>
        </Link>
        <Pressable
          accessibilityLabel="Open Profile"
          onPress={() => router.replace('/profile')}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArtistAvatar size={40} />
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <CreateMusicSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  )
}

export function StudioCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, gap: 12 }}
    >
      {children}
    </View>
  )
}

export function StudioButton({ title, href, secondary = false }: { title: string; href: Href; secondary?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        style={{
          minHeight: 48,
          paddingHorizontal: 18,
          borderRadius: 14,
          backgroundColor: secondary ? c.oat : c.berry,
          borderWidth: secondary ? 1 : 0,
          borderColor: c.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: secondary ? c.ink : c.berryDark, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      </Pressable>
    </Link>
  )
}

export function SectionTitle({ title, action, href }: { title: string; action?: string; href?: Href }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ flex: 1, color: c.ink, fontSize: 21, fontWeight: '800' }}>{title}</Text>
      {action && href && (
        <Link href={href} asChild>
          <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: c.berry, fontWeight: '700' }}>{action} →</Text>
          </Pressable>
        </Link>
      )}
    </View>
  )
}

export function ReleaseRow({ release }: { release: StudioRelease }) {
  return (
    <Link href={`/studio/release/${release.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        style={{
          minHeight: 84,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <StudioCover release={release} size={60} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {release.title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {release.kind} · {release.date}
          </Text>
          <StudioStatus status={release.status} />
        </View>
        {release.plays !== undefined && (
          <Text style={{ color: c.ink, fontWeight: '700' }}>{release.plays.toLocaleString()}</Text>
        )}
        <Ionicons name="chevron-forward" size={17} color={c.muted} />
      </Pressable>
    </Link>
  )
}
