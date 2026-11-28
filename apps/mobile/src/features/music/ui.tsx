import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, Text, TextInput, type TextInputProps } from "react-native";
import { encoreColors as c } from "@/features/encore/ui/tokens";

export const formatLabel = (value: string) => value.toLowerCase().replaceAll("_", " ");
export const elapsed = (seconds: number) => {
  const time = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
};

export function MusicPage({ children }: PropsWithChildren) {
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 38, gap: 14 }}>{children}</ScrollView>;
}

export function Heading({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 28, fontWeight: "800" }}>{children}</Text>;
}

export function Action({ label, run, disabled, selected }: { label: string; run: () => void; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={run}
    style={{ minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, backgroundColor: selected ? c.berry : c.oat, borderColor: c.border, borderWidth: 1, borderRadius: 12, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: selected ? c.berryDark : c.ink, fontWeight: "600" }}>{label}</Text>
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <>
    <Text style={{ color: c.muted }}>{label}</Text>
    <TextInput accessibilityLabel={label} {...props} style={{ minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.white, color: c.ink, padding: 10 }} placeholderTextColor={c.muted} />
  </>;
}

export function Note({ children }: PropsWithChildren) {
  return <Text style={{ color: c.muted }}>{children}</Text>;
}
