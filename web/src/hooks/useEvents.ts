import { useState, useEffect, useMemo } from 'react';
import type { YogaEvent } from '../types.ts';
import { LOCATIONS } from '../constants.ts';
import { extractVEvents, parseField, parseIcalDate } from '../utils/ical-parser.ts';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function useEvents(selectedAbbrs: string[], category: string = "yoga") {
  const [allEvents, setAllEvents] = useState<YogaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all locations once on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const results = await Promise.all(
          LOCATIONS.map(async (loc) => {
            const res = await fetch(`/calendars/${category}/${loc.abbr}.ics`);
            if (!res.ok) throw new Error(`Failed to fetch ${loc.abbr}.ics: ${res.status}`);
            const text = await res.text();
            const vevents = extractVEvents(text);

            return vevents.map((vevent): YogaEvent => {
              const soldOutRaw = parseField(vevent, 'X-SOLD-OUT');
              return {
                uid: parseField(vevent, 'UID') ?? '',
                title: parseField(vevent, 'SUMMARY') ?? '',
                description: parseField(vevent, 'DESCRIPTION')
                  ?.replace(/\\n/g, '\n')
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .replace(/\\\\/g, '\\') ?? '',
                startTime: parseIcalDate(parseField(vevent, 'DTSTART') ?? ''),
                endTime: parseIcalDate(parseField(vevent, 'DTEND') ?? parseField(vevent, 'DTSTART') ?? ''),
                url: parseField(vevent, 'URL') || undefined,
                locationAbbr: loc.abbr,
                soldOut: soldOutRaw === 'TRUE' ? true : soldOutRaw === 'FALSE' ? false : undefined,
                lastModified: parseField(vevent, 'X-LAST-MODIFIED') || undefined,
              };
            });
          }),
        );

        if (cancelled) return;

        const today = startOfToday();
        const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        const merged = results
          .flat()
          .filter((e) => e.endTime > new Date() && e.startTime < twoWeeks)
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        setAllEvents(merged);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load events');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [category]);

  // Filter by selected locations in memory
  const events = useMemo(
    () => allEvents.filter((e) => selectedAbbrs.includes(e.locationAbbr)),
    [allEvents, selectedAbbrs],
  );

  return { events, loading, error };
}
