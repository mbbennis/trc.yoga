/**
 * Extract VEVENT blocks from raw iCal text.
 */
export function extractVEvents(ical: string): string[] {
  const events: string[] = [];
  const lines = ical.split(/\r?\n/);
  let inside = false;
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') {
      inside = true;
      current = [line];
    } else if (line.trim() === 'END:VEVENT') {
      current.push(line);
      events.push(current.join('\r\n'));
      inside = false;
      current = [];
    } else if (inside) {
      current.push(line);
    }
  }

  return events;
}

/**
 * Unfold iCal continuation lines (lines starting with space/tab are continuations).
 */
function unfold(vevent: string): string[] {
  const lines = vevent.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

/**
 * Parse a single iCal field value from a VEVENT block.
 */
export function parseField(vevent: string, field: string): string | undefined {
  const unfolded = unfold(vevent);
  const pattern = new RegExp(`^${field}[;:](.*)$`, 'i');
  for (const line of unfolded) {
    const match = line.match(pattern);
    if (match) {
      const colonIdx = line.indexOf(':', field.length);
      if (colonIdx !== -1) {
        return line.slice(colonIdx + 1);
      }
      return match[1];
    }
  }
  return undefined;
}

/**
 * Parse an iCal date string into a JS Date.
 * Handles: YYYYMMDD, YYYYMMDDTHHmmss (local), YYYYMMDDTHHmmssZ (UTC)
 */
export function parseIcalDate(value: string): Date {
  const s = value.trim();

  const year = parseInt(s.slice(0, 4), 10);
  const month = parseInt(s.slice(4, 6), 10) - 1;
  const day = parseInt(s.slice(6, 8), 10);

  if (s.length === 8) {
    // Date-only: YYYYMMDD
    return new Date(year, month, day);
  }

  const hour = parseInt(s.slice(9, 11), 10);
  const minute = parseInt(s.slice(11, 13), 10);
  const second = parseInt(s.slice(13, 15), 10);

  if (s.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  // Local time
  return new Date(year, month, day, hour, minute, second);
}
