import type { ScanPayload } from "./scan-engine";

export function cosmetologistReply(
  userText: string,
  scan: ScanPayload | null
): string {
  const t = userText.toLowerCase();
  const score = scan?.overallScore ?? 78;
  const hydration = scan?.metrics.find((m) => m.id === "hydration")?.score ?? 72;
  const barrier = scan?.metrics.find((m) => m.id === "barrier")?.score ?? 81;
  const pigment = scan?.metrics.find((m) => m.id === "pigment")?.score ?? 63;

  if (/hydrat|dry|dehydrat/.test(t)) {
    return `Hydration is sitting at ${hydration}. Tonight: HA serum on damp skin, seal with ceramide cream, skip harsh foaming cleansers. Re-scan in 3 days — we want 80+.`;
  }
  if (/cleanser|wash|cleanse/.test(t)) {
    return `Swap to a gentle gel cleanser AM (and oil + gel PM if wearing SPF). Your barrier is ${barrier}; stripping surfactants would undo that recovery.`;
  }
  if (/spf|sun|travel|kit/.test(t)) {
    return `Travel kit: mineral SPF 50, mini HA, niacinamide, and ceramide cream. Pigment is ${pigment} — reapply SPF every 2h outdoors.`;
  }
  if (/routine|am|pm|night|morning/.test(t)) {
    return `Keep AM short (cleanse → niacinamide → moisturize → SPF). PM: cleanse → azelaic 3×/week → ceramide. Overall score ${score} — consistency beats more actives.`;
  }
  if (/retinol|retinoid|acid|exfol/.test(t)) {
    return `With barrier at ${barrier}, hold retinoid if <78. Prefer azelaic or lactic 1–2×/week max until barrier clears 80.`;
  }
  if (/why|score|scan|result/.test(t)) {
    return (
      scan?.summary ??
      `Latest overall score is ${score}. Open Concerns for zone-level confidence and matched ingredients.`
    );
  }

  return `Got it — logged against your latest scan (score ${score}). I’ll bias routine tips toward hydration ${hydration} and even tone ${pigment}. Ask about SPF, cleanser swaps, or travel kits anytime.`;
}
