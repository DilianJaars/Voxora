// Optional LLM (Anthropic) for summaries, notes and translation. Features degrade gracefully without a key.
export async function llm(prompt: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`AI error ${r.status}`);
  const j = await r.json();
  return j.content?.map((c: any) => c.text).join('') ?? null;
}

// Fallback summary without an LLM: pick the highest-scoring sentences by word frequency.
export function extractiveSummary(text: string, n = 6): string {
  const sents = text.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+/g) || [text.slice(0, 500)];
  const stop = new Set('the a an and or but of to in on for with is are was were be been it this that as at by from not have has had you your we they he she i'.split(' '));
  const freq: Record<string, number> = {};
  for (const w of text.toLowerCase().match(/[a-z']+/g) || []) if (!stop.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1;
  const scored = sents.map((s, i) => ({ s: s.trim(), i, score: (s.toLowerCase().match(/[a-z']+/g) || []).reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(s.length + 20) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s).join(' ');
}
