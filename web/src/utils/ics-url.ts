/**
 * Build a relative .ics URL for the given location abbreviations.
 * Matches the Lambda's power-set naming convention: sorted, joined with "_".
 */
export function buildIcsUrl(abbrs: string[], category: string = "yoga"): string {
  const sorted = [...abbrs].sort();
  return `/calendars/${category}/${sorted.join('_')}.ics`;
}
