// Small in-memory limiter per IP. Good enough for a single instance; use Redis/Upstash if you scale out.
const hits = new Map<string, number[]>();
export function limited(req: Request, bucket: string, max: number, windowMs = 60_000): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}
export const tooMany = () => new Response(JSON.stringify({ error: 'Too many requests. Wait a minute and try again.' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '60' } });
