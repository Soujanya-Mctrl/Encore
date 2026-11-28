import React, { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { encoreApiFetch } from '../../lib/api-client'
import { encoreColors as c } from '@/features/encore/ui/tokens'

export default function StudioCampaignsScreen() {
  const [milestoneId, setMilestoneId] = useState('')
  const [evidenceUri, setEvidenceUri] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function submitMilestone() {
    try {
      setMessage(null)
      await encoreApiFetch('/api/v1/campaigns/milestones', {
        method: 'POST',
        body: JSON.stringify({ milestoneId, evidenceUri }),
      })
      setMessage('Milestone evidence submitted for review')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to submit milestone evidence')
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
      <Text style={{ color: c.ink, fontSize: 22, fontWeight: '700' }}>Artist Studio · Pass Series & Campaigns</Text>
      <View
        style={{
          marginTop: 14,
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: c.border,
          gap: 10,
        }}
      >
        <Text style={{ color: c.muted, fontSize: 13 }}>
          Create finite Supporter Pass series (5% primary fee, 10% resale artist fee) or devnet campaign escrow goals
          bound to your active Music Passport version.
        </Text>
        <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>Submit Milestone Evidence</Text>
        <TextInput
          value={milestoneId}
          onChangeText={setMilestoneId}
          placeholder="Milestone ID"
          placeholderTextColor={c.muted}
          style={{
            color: c.ink,
            backgroundColor: c.oat,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 8,
            padding: 10,
          }}
        />
        <TextInput
          value={evidenceUri}
          onChangeText={setEvidenceUri}
          placeholder="https://... evidence URL"
          placeholderTextColor={c.muted}
          style={{
            color: c.ink,
            backgroundColor: c.oat,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 8,
            padding: 10,
          }}
        />
        <Pressable
          onPress={() => void submitMilestone()}
          style={{ backgroundColor: c.berry, borderRadius: 8, padding: 10, alignItems: 'center' }}
        >
          <Text style={{ color: c.berryDark, fontWeight: '700' }}>Submit Evidence</Text>
        </Pressable>
        {message ? <Text style={{ color: c.berry, fontSize: 12 }}>{message}</Text> : null}
      </View>
    </ScrollView>
  )
}
