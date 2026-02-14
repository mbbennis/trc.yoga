/**
 * Build a relative .ics URL for the given location abbreviations.
 * Matches the Lambda's power-set naming convention: sorted, joined with "_".
 */
export function buildIcsUrl(abbrs: string[]): string {
  const sorted = [...abbrs].sort();
  return `/${sorted.join('_')}.ics`;
}
