/** "2026.11" for the build date (UTC, so the same commit builds the same revision anywhere). */
export function revOf(date: Date): string {
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Fills `copy.titleBlock.revLine` ("rev {rev} · sheet 1 of 1 · scale 1:1"). */
export function revLine(template: string, buildDate: Date): string {
  return template.replace('{rev}', revOf(buildDate));
}
