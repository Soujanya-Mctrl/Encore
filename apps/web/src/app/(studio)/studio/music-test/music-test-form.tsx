"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LyricReviewLine } from "@encore/core";
import styles from "./studio.module.css";

const moods = {
  Calm: /\b(calm|relaxed|peaceful|chill)\b/i,
  Joyful: /\b(joyful|happy|upbeat|cheerful)\b/i,
  Energetic: /\b(energetic|excited|pumped|intense)\b/i,
  Melancholic: /\b(melancholic|sad|wistful|somber)\b/i,
  Dark: /\b(dark|eerie|tense|ominous)\b/i,
};
type Mood = keyof typeof moods;
type Section = { id: string; name: string; seconds: string; lyrics: string; direction: string };
const trainVerse = "Rain writes silver on the glass\nStation lights go slipping past\nI fold the ticket in my sleeve\nWith all the things I couldn’t leave";
const trainChorus = "Last train home, carry me slow\nPast the streets that used to know\nEvery version I outgrew\nLeave a little light, I’m coming through";
const trainSections = [
  ["Intro", "8", "", "Solo felt piano and room tone"],
  ["Verse", "24", trainVerse, "Close lead vocal, brushed drums and soft bass"],
  ["Chorus", "24", trainChorus, "Wider piano, layered harmonies and a steady backbeat"],
  ["Bridge", "16", "", "Instrumental breakdown, piano and bass only"],
  ["Final chorus", "24", trainChorus, "Fullest harmonies and strongest backbeat"],
  ["Outro", "8", "", "Strip back to piano, ending on one held chord"],
] as const;
type Recognition = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function MusicTestForm() {
  const [mode, setMode] = useState("beat");
  const [mood, setMood] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("20");
  const [bpm, setBpm] = useState("100");
  const [verse, setVerse] = useState("");
  const [chorus, setChorus] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [avoid, setAvoid] = useState("");
  const [key, setKey] = useState("A");
  const [scale, setScale] = useState("minor");
  const total = sections.reduce((sum, section) => sum + Number(section.seconds), 0);
  const [speechStatus, setSpeechStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [review, setReview] = useState<{ audioHash: string; timestampsAvailable: boolean; lines: LyricReviewLine[] }>();
  const [approvedAt, setApprovedAt] = useState("");
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Section[]>([]);
  const [toolMessage, setToolMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [provenance, setProvenance] = useState<{
    local: { kind: string; comparedSeconds?: number; uploadOffsetSeconds?: number; referenceHash?: string };
    watermark: { status: string; model?: string };
  }>();
  const player = useRef<HTMLAudioElement>(null);
  const [title, setTitle] = useState("");
  const [renderedTrack, setRenderedTrack] = useState<{ title: string; seconds: number }>();
  const recognition = useRef<Recognition | null>(null);
  const requestPending = useRef(false);

  useEffect(() => () => recognition.current?.abort(), []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  function loadPreset() {
    setTitle("Last Train Home");
    setMode("song");
    setPrompt("A warm indie-soul song about catching the last train home after a long night.");
    setMood("Wistful and intimate, building into a warm and hopeful chorus");
    setAvoid("Trap hi-hat rolls, heavy distortion, EDM drops, spoken narration");
    setBpm("92");
    setKey("A");
    setScale("minor");
    setSections(trainSections.map(([name, seconds, lyrics, direction]) =>
      ({ id: crypto.randomUUID(), name, seconds, lyrics, direction })));
  }

  function updateSection(id: string, change: Partial<Section>) {
    setSections((items) => items.map((item) => item.id === id ? { ...item, ...change } : item));
  }

  function moveSection(index: number, offset: number) {
    setSections((items) => {
      const moved = items[index];
      if (!moved || !items[index + offset]) return items;
      const next = [...items];
      next.splice(index, 1);
      next.splice(index + offset, 0, moved);
      return next;
    });
  }

  async function arrange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlanning(true);
    setProposal([]);
    setToolMessage("");
    const form = new FormData(event.currentTarget);
    const currentSections = sections.length ? sections : verse.trim() && chorus.trim() ? [
      { name: "Verse", seconds: String(Math.floor(Number(duration) / 2)), lyrics: verse, direction: "" },
      { name: "Chorus", seconds: String(Math.ceil(Number(duration) / 2)), lyrics: chorus, direction: "" },
    ] : [];
    try {
      const response = await fetch("/api/v1/studio/music-test/arrange", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: [prompt, mood, instruction].filter(Boolean).join("\n"),
          seconds: Number(form.get("seconds")),
          ...(mode === "song" && currentSections.some((item) => item.lyrics.trim()) && {
            current: { mode: "song", prompt: prompt || instruction, bpm: Number(bpm), key, scale, mood, avoid,
              durationSeconds: currentSections.reduce((sum, section) => sum + Number(section.seconds), 0),
              sections: currentSections.map(({ name, seconds, lyrics, direction }) =>
                ({ name, seconds: Number(seconds), lyrics: lyrics.trim(), direction })),
            },
          }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProposal(result.sections.map((section: Omit<Section, "id" | "seconds"> & { seconds: number }) =>
        ({ ...section, seconds: String(section.seconds), id: crypto.randomUUID() })));
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "Arrangement failed.");
    } finally { setPlanning(false); }
  }

  async function checkUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setProvenance(undefined);
    setToolMessage("");
    try {
      const response = await fetch("/api/v1/studio/music-test/check", {
        method: "POST", body: new FormData(event.currentTarget),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProvenance(result);
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "Upload check failed.");
    } finally { setChecking(false); }
  }

  function listen(applyTranscript?: (value: string) => void) {
    const browser = window as RecognitionWindow;
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechStatus("Speech recognition is unavailable in this browser. Choose a mood below.");
      return;
    }
    const speech = new SpeechRecognition();
    recognition.current = speech;
    speech.lang = "en-US";
    speech.onresult = (event) => {
      const words = event.results[0]?.[0]?.transcript.trim() ?? "";
      if (!words) {
        setSpeechStatus("No speech recognized. Try again or type your brief.");
        return;
      }
      if (applyTranscript) {
        applyTranscript(words.slice(0, 1000));
        setSpeechStatus("Dictation added. Review the text before generating.");
        return;
      }
      setPrompt(words.slice(0, 500));
      const seconds = words.match(/\b(\d+(?:\.\d+)?)\s*[- ]?\s*(seconds?|minutes?)\b/i);
      if (seconds) {
        const length = Math.round(Number(seconds[1]) * (seconds[2]?.toLowerCase().startsWith("minute") ? 60 : 1));
        if (length >= 6 && length <= 120) setDuration(String(length));
      }
      const tempo = Number(words.match(/\b(\d+)\s*bpm\b/i)?.[1]);
      if (tempo >= 40 && tempo <= 240) setBpm(String(tempo));
      if (/\b(with lyrics|with vocals|sung vocals)\b/i.test(words)) setMode("song");
      else if (/\binstrumental\b/i.test(words)) setMode("instrumental");
      else if (/\bbeat\b/i.test(words)) setMode("beat");
      const matches = (Object.keys(moods) as Mood[]).filter((option) => moods[option].test(words));
      const [suggestion] = matches;
      setMood(matches.join(", "));
      if (suggestion && matches.length === 1) {
        setMood(suggestion);
        setSpeechStatus(`Brief transcribed. Suggested mood: ${suggestion}.`);
      } else {
        setSpeechStatus("Brief transcribed. ElevenLabs will use the mood and style described in it.");
      }
    };
    speech.onerror = () => setSpeechStatus("Microphone recognition failed. Choose a mood below.");
    speech.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    try {
      speech.start();
      setListening(true);
      setSpeechStatus("Listening…");
    } catch {
      recognition.current = null;
      setSpeechStatus("Could not start the microphone.");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current) return;
    const arranged = mode === "song" && sections.length > 0;
    if (arranged && (total < 6 || total > 120 || !sections.some((item) => item.lyrics.trim()))) {
      setError("Use 6–120 seconds total and add lyrics to at least one section.");
      return;
    }
    requestPending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/studio/music-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, prompt, mood, avoid, durationSeconds: arranged ? total : Number(duration),
          bpm: Number(bpm), key, scale,
          ...(arranged ? { sections: sections.map(({ name, seconds, lyrics, direction }) =>
            ({ name, seconds: Number(seconds), lyrics: lyrics.trim(), direction })) } :
            mode === "song" ? { verse, chorus } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed.");
      }
      if (response.headers.get("content-type")?.includes("multipart/form-data")) {
        const result = await response.formData();
        const audio = result.get("audio");
        const report = result.get("review");
        if (!(audio instanceof Blob) || typeof report !== "string") throw new Error("Incomplete song response.");
        setReview(JSON.parse(report));
        setAudioUrl(URL.createObjectURL(audio));
      } else {
        setReview(undefined);
        setAudioUrl(URL.createObjectURL(await response.blob()));
      }
      setApprovedAt("");
      setRenderedTrack({ title: title.trim() || "Untitled track", seconds: arranged ? total : Number(duration) });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Generation failed.");
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  }

  const timeline = mode === "song" ? sections : [];
  return <main className={styles.studio}>
    <header className={styles.header}>
      <strong>Encore / Studio</strong>
      <nav aria-label="Studio"><a href="#create">Create</a><a href="#arrangement">Arrangement</a><a href="#takes">Takes</a></nav>
    </header>
    <div className={styles.workspace}>
      <form id="create" onSubmit={generate} className={styles.editor}>
    <h1>Create a track</h1>
    <label>Title <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Untitled track" /></label>
    <button type="button" className="justify-self-start underline" onClick={loadPreset}>Load “Last Train Home” arrangement</button>
    <div>
      <button type="button" className="underline" onClick={() => listen()} disabled={listening}>Dictate music brief</button>
      <p className="text-sm">Try “Make a 30-second dreamy lo-fi beat at 90 BPM.” Your browser may process microphone audio online.</p>
      <p role="status">{speechStatus}</p>
    </div>
    <label>Mode <select value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="beat">Beat</option><option value="instrumental">Instrumental</option>
      <option value="song">Song with lyrics</option>
    </select></label>
    <label className="grid">Prompt <textarea name="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} required maxLength={500} rows={3} /></label>
    <div>
      <label className="grid">Mood and style <input list="music-moods" value={mood} maxLength={300} onChange={(event) => setMood(event.target.value)} placeholder="Dreamy, quietly tense, then euphoric" /></label>
      <datalist id="music-moods">{Object.keys(moods).map((option) => <option key={option} value={option} />)}</datalist>
    </div>
    <label className="grid">Avoid <input value={avoid} onChange={(event) => setAvoid(event.target.value)} maxLength={300} placeholder="Heavy bass, distorted guitars" /></label>
    {!(mode === "song" && sections.length) && <label>Duration (seconds) <input type="number" value={duration} onChange={(event) => setDuration(event.target.value)} min={6} max={120} required /></label>}
    <label>Target BPM <input name="bpm" type="number" value={bpm} onChange={(event) => setBpm(event.target.value)} min={40} max={240} required /></label>
    <label>Target key <select value={key} onChange={(event) => setKey(event.target.value)}>
      {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((key) => <option key={key}>{key}</option>)}
    </select></label>
    <label>Scale <select value={scale} onChange={(event) => setScale(event.target.value)}><option>major</option><option>minor</option></select></label>
    {mode === "song" && sections.length === 0 && <>
      <label className="grid">Verse <textarea name="verse" value={verse} onChange={(event) => setVerse(event.target.value)} required maxLength={1000} /></label>
      <button type="button" className="justify-self-start underline" onClick={() => listen(setVerse)} disabled={listening}>Dictate verse</button>
      <label className="grid">Chorus <textarea name="chorus" value={chorus} onChange={(event) => setChorus(event.target.value)} required maxLength={1000} /></label>
      <button type="button" className="justify-self-start underline" onClick={() => listen(setChorus)} disabled={listening}>Dictate chorus</button>
    </>}
    {mode === "song" && <>
      {sections.length > 0 && <h2>Section settings</h2>}
      {sections.map((section, index) => <fieldset id={`section-${section.id}`} key={section.id} className="grid gap-2 border p-3">
        <legend>{section.name || "Untitled section"}</legend>
        <label>Name <input required maxLength={40} value={section.name} onChange={(e) => updateSection(section.id, { name: e.target.value })} /></label>
        <label>Seconds <input required type="number" min={3} max={120} value={section.seconds} onChange={(e) => updateSection(section.id, { seconds: e.target.value })} /></label>
        <label className="grid">Direction <input maxLength={200} value={section.direction} onChange={(e) => updateSection(section.id, { direction: e.target.value })} /></label>
        <label className="grid">Lyrics (leave blank for instrumental) <textarea maxLength={1000} value={section.lyrics} onChange={(e) => updateSection(section.id, { lyrics: e.target.value })} /></label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="underline" disabled={listening} onClick={() => listen((lyrics) => updateSection(section.id, { lyrics }))}>Dictate lyrics</button>
          <button type="button" className="underline" disabled={index === 0} onClick={() => moveSection(index, -1)}>Move up</button>
          <button type="button" className="underline" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>Move down</button>
          <button type="button" className="underline" onClick={() => setSections((items) => items.filter((item) => item.id !== section.id))}>Remove</button>
        </div>
      </fieldset>)}
      <button type="button" className="justify-self-start underline" disabled={sections.length >= 12} onClick={() => {
        const id = crypto.randomUUID();
        setSections((items) => [...items, { id, name: "Section", seconds: "10", lyrics: "", direction: "" }]);
      }}>Add section</button>
    </>}
    <button className={styles.generate} type="submit" disabled={busy || listening}>{busy ? "Generating…" : "Generate music"}</button>
    <small>Generation uses ElevenLabs credits.</small>
    {error && <p role="alert">{error}</p>}
      </form>
      <div className={styles.monitor}>
        <section className={styles.panel}>
          <h2>Arrangement assistant</h2>
          <form className={styles.take} onSubmit={arrange}>
            <label className="grid">Arrangement request <textarea value={instruction} maxLength={650} required
              onChange={(event) => setInstruction(event.target.value)} placeholder="Shorten the intro and add a quiet instrumental bridge." /></label>
            <button type="button" className="underline justify-self-start" onClick={() => listen((value) => setInstruction(value.slice(0, 650)))} disabled={listening}>Dictate request</button>
            <label>Target seconds <input type="number" name="seconds" min={6} max={120} defaultValue={60} required /></label>
            <button className="underline justify-self-start" disabled={planning || listening}>{planning ? "Planning…" : "Propose arrangement"}</button>
          </form>
          {proposal.length > 0 && <div className={styles.take}>
            <ol>{proposal.map((section) => <li key={section.id}><strong>{section.name} · {section.seconds}s</strong><p>{section.direction}</p>{section.lyrics && <p className="whitespace-pre-line">{section.lyrics}</p>}</li>)}</ol>
            <button type="button" className={styles.generate} onClick={() => {
              setMode("song"); setPrompt(prompt || instruction.slice(0, 500)); setSections(proposal); setProposal([]);
            }}>Apply proposal</button>
            <button type="button" className="underline justify-self-start" onClick={() => setProposal([])}>Discard proposal</button>
          </div>}
        </section>
        <section id="arrangement" className={styles.panel}>
          <div className={styles.panelHeading}><h2>Arrangement</h2><span>{timeline.length ? total : duration || 0}s target</span></div>
          <div className={styles.timeline} aria-label="Section durations">
            {timeline.length ? timeline.map((section) => <a key={section.id}
              style={{ flexGrow: Math.max(Number(section.seconds) || 0, 1) }}
              href={`#section-${section.id}`} title={`${section.name} · ${section.seconds}s`}>
              <strong>{section.name || "Section"}</strong><small>{section.seconds || 0}s</small>
            </a>) : <div className={styles.singleTrack}><strong>{mode === "song" ? "Verse → Chorus" : mode === "beat" ? "Beat" : "Instrumental"}</strong><small>{duration || 0}s</small></div>}
          </div>
          <p className={styles.muted}>{bpm || "—"} BPM · {key} {scale}{mood && ` · ${mood}`}</p>
        </section>
        <section className={styles.panel}>
          <h2>Check audio provenance</h2>
          <form className={styles.take} onSubmit={checkUpload}>
            <input aria-label="Audio to check" name="audio" type="file" accept="audio/*" required />
            <label><input name="consent" type="checkbox" value="yes" /> Also send this file to ElevenLabs for a watermark check</label>
            <button className="underline justify-self-start" disabled={checking}>{checking ? "Checking…" : "Check upload"}</button>
          </form>
          {provenance && <div className={styles.take} role="status">
            <p>{provenance.local.kind === "exact_file" ? "Exact match to a locally generated take." :
              provenance.local.kind === "decoded_audio" ? "Decoded audio matches a locally generated take in the first 120 seconds." :
              provenance.local.kind === "fingerprint_candidate" ? `Possible match to a local AI take: approximately ${provenance.local.comparedSeconds}s compared from ${provenance.local.uploadOffsetSeconds}s in the upload.` :
              provenance.local.kind === "decode_unavailable" ? "Audio fingerprint unavailable." : "No local match found."}</p>
            {provenance.local.referenceHash && <small className="break-all">Reference SHA-256: {provenance.local.referenceHash}</small>}
            <p>{provenance.watermark.status === "detected" ? `ElevenLabs watermark detected${provenance.watermark.model ? ` · ${provenance.watermark.model}` : ""}.` :
              provenance.watermark.status === "not_detected" ? "ElevenLabs watermark not detected." :
              provenance.watermark.status === "unavailable" ? "Watermark check unavailable." : "Watermark check skipped."}</p>
            <small>Origin remains unverified without supporting evidence. Review possible matches before changing a disclosure.</small>
          </div>}
          {toolMessage && <p role="alert">{toolMessage}</p>}
        </section>
        <section id="takes" className={styles.panel}>
          <div className={styles.panelHeading}><h2>Session takes</h2>{renderedTrack && <span>1 take</span>}</div>
          {busy && <p role="status">Rendering with ElevenLabs…</p>}
          {audioUrl && renderedTrack ? <div className={styles.take}>
            <strong>{renderedTrack.title}</strong><small>{renderedTrack.seconds}s requested</small>
            <audio ref={player} aria-label="Generated music preview" controls src={audioUrl} />
            <a href={audioUrl} download="encore-track.mp3">Download MP3</a>
          </div> : !busy && <p className={styles.muted}>Your generated track will appear here for playback and download.</p>}
        </section>
        {review && <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>Lyrics review</h2>{approvedAt && <span>Approved locally</span>}</div>
          <p className={styles.muted}>{review.timestampsAvailable
            ? "Compare your lyrics with the provider’s reported words. Listen before approving."
            : "No word timestamps were returned. Listen to the full take to review it."}</p>
          <ol className={styles.take}>
            {review.lines.map((line, index) => <li key={index} className="border-b border-current/20 pb-2">
              <small>{line.section} · {line.status === "variation" ? "Possible variation" : line.status === "match" ? "Match" : "Uncertain"}</small>
              <p>{line.expected}</p>
              {line.status === "variation" && <p className={styles.muted}>Reported: {line.heard}</p>}
              {line.startMs !== undefined && <button type="button" className="underline" onClick={() => {
                if (!player.current || line.startMs === undefined) return;
                player.current.currentTime = line.startMs / 1000;
                void player.current.play().catch(() => {});
              }}>Listen from {(line.startMs / 1000).toFixed(1)}s</button>}
            </li>)}
          </ol>
          <button type="button" className={styles.generate} disabled={!!approvedAt} onClick={() => setApprovedAt(new Date().toISOString())}>Approve this take</button>
          {approvedAt && <a className="ml-3" download="encore-lyric-review.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({
            version: 1, type: "encore-local-lyric-review", audioHash: review.audioHash, approvedAt,
            timestampsAvailable: review.timestampsAvailable,
            summary: Object.fromEntries(["match", "variation", "uncertain"].map((status) =>
              [status, review.lines.filter((line) => line.status === status).length])),
          }, null, 2))}`}>Download review receipt</a>}
        </section>}
      </div>
    </div>
  </main>;
}
