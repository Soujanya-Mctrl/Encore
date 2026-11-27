import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import type { Track } from '@/features/encore/fixtures'

export function AlbumArt({ track, size = 80, radius = 12 }: { track: Track; size?: number | `${number}%`; radius?: number }) {
  const palette = {
    echoes: ['#151222', '#8D74C5', '#D4C1FB'],
    cosmic: ['#071828', '#35D4C4', '#E279C9'],
    neon: ['#1A1030', '#FA5D9B', '#7C8CFF'],
    solar: ['#192E3F', '#F6B475', '#F6D8C4'],
  }[track.id] ?? ['#192E3F', '#F6B475', '#F6D8C4']
  const uid = track.id
  return <Svg width={size} height={size} viewBox="0 0 200 200" style={{ borderRadius: radius, overflow: 'hidden' }}>
    <Defs><LinearGradient id={`bg-${uid}`} x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor={palette[0]} /><Stop offset="1" stopColor={track.color} /></LinearGradient><LinearGradient id={`glow-${uid}`} x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor={palette[1]} /><Stop offset="1" stopColor={palette[2]} /></LinearGradient></Defs>
    <Rect width="200" height="200" fill={`url(#bg-${uid})`} />
    {track.id === 'echoes' ? <>
      <Circle cx="100" cy="98" r="52" fill="#E6DFE3" opacity="0.92" />
      <Path d="M68 60 Q100 38 132 60 L124 72 Q100 65 76 72Z M72 84 Q100 75 128 84 L122 134 Q100 149 78 134Z" fill="#A9A1B2" />
      <Path d="M-15 128 C40 80 63 150 110 93 S180 50 225 92 M-20 147 C42 98 68 166 112 111 S176 71 222 111" stroke={palette[2]} strokeWidth="5" fill="none" opacity="0.85" />
    </> : track.id === 'cosmic' ? <>
      {[0, 1, 2, 3, 4].map((i) => <Circle key={i} cx={28 + i * 37} cy={32 + (i % 2) * 27} r={2 + i % 3} fill="#FFFFFF" opacity="0.8" />)}
      <Path d="M-10 116 C10 44 28 178 48 105 S75 42 96 110 S126 170 145 99 S178 47 210 112" stroke={`url(#glow-${uid})`} strokeWidth="6" fill="none" />
      <Path d="M-10 136 C15 86 29 155 50 125 S76 67 96 131 S127 151 150 114 S176 94 210 132" stroke={palette[1]} strokeWidth="3" fill="none" opacity="0.7" />
    </> : track.id === 'neon' ? <>
      <Circle cx="100" cy="100" r="55" fill="none" stroke={palette[1]} strokeWidth="3" />
      <Circle cx="100" cy="100" r="38" fill="none" stroke={palette[2]} strokeWidth="6" />
      <Path d="M0 158 L92 52 L116 97 L200 12 M0 188 L100 91 L134 141 L200 73" fill="none" stroke={palette[1]} strokeWidth="8" opacity="0.85" />
    </> : <>
      <Circle cx="140" cy="69" r="39" fill={palette[1]} />
      <Ellipse cx="100" cy="197" rx="165" ry="84" fill="#345A67" />
      <Path d="M0 158 Q80 129 200 169 M0 176 Q70 158 200 192" stroke={palette[2]} strokeWidth="3" fill="none" opacity="0.8" />
    </>}
    <Rect x="0" y="166" width="200" height="34" fill="#120F19" opacity="0.3" />
  </Svg>
}
