export type LyricReviewLine = {
  section: string;
  expected: string;
  heard?: string;
  startMs?: number;
  status: "match" | "variation" | "uncertain";
};

type TimedWord = { word: string; startMs: number };

const tokenize = (text: string): string[] =>
  text.normalize("NFKC").toLowerCase().replace(/[’']/g, "").match(/[\p{L}\p{N}]+/gu) ?? [];

function editDistance(expected: string[], actual: string[]) {
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (const [i, word] of expected.entries()) {
    const current = [i + 1];
    for (const [j, heard] of actual.entries()) {
      current.push(Math.min(previous[j + 1]! + 1, current[j]! + 1, previous[j]! + Number(word !== heard)));
    }
    previous = current;
  }
  return previous[actual.length]!;
}

export function reviewLyrics(
  sections: readonly { name: string; lyrics: string }[],
  timestamps: readonly TimedWord[],
): LyricReviewLine[] {
  const words = timestamps.flatMap((entry) => tokenize(entry.word).map((token) => ({ ...entry, token })));
  let cursor = 0;
  return sections.flatMap(({ name, lyrics }) => lyrics.split(/\r?\n/).flatMap((expected): LyricReviewLine[] => {
    const tokens = tokenize(expected);
    if (!tokens.length) return [];
    const line = { section: name, expected };
    let best: { start: number; length: number; distance: number; score: number } | undefined;
    const tolerance = tokens.length >= 4 ? 2 : Math.floor(tokens.length / 3);
    for (let start = cursor; start < Math.min(words.length, cursor + 16); start++) {
      for (let length = Math.max(1, tokens.length - tolerance); length <= tokens.length + tolerance && start + length <= words.length; length++) {
        const actual = words.slice(start, start + length).map(({ token }) => token);
        if (tolerance === 2 && new Set(actual.filter((token) => tokens.includes(token))).size < 2) continue;
        const distance = editDistance(tokens, actual);
        const score = distance + (start - cursor) / 32;
        if (distance <= tolerance && (!best || score < best.score)) best = { start, length, distance, score };
      }
      if (best?.distance === 0) break;
    }
    if (!best) return [{ ...line, status: "uncertain" }];
    cursor = best.start + best.length;
    return [{
      ...line, status: best.distance ? "variation" : "match",
      heard: words.slice(best.start, cursor).map(({ token }) => token).join(" "),
      startMs: words[best.start]!.startMs,
    }];
  }));
}
