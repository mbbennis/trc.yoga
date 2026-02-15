import { useState } from 'react';
import { LOCATIONS } from './constants.ts';
import { useEvents } from './hooks/useEvents.ts';
import LocationChips from './components/LocationChips.tsx';
import CopyLinkButton from './components/CopyLinkButton.tsx';
import EventList from './components/EventList.tsx';

const COOKIE_NAME = 'selectedLocations';
const allAbbrs = LOCATIONS.map((l) => l.abbr);

function readCookie(): string[] | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  const abbrs = decodeURIComponent(match[1]).split(',').filter((a) => allAbbrs.includes(a));
  return abbrs.length > 0 ? abbrs : null;
}

function writeCookie(abbrs: string[]) {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(abbrs.join(','))};expires=${expires};path=/;SameSite=Lax`;
}

function App() {
  const [selected, setSelected] = useState<string[]>(
    () => readCookie() ?? allAbbrs,
  );

  const { events, loading, error } = useEvents(selected);

  function toggle(abbr: string) {
    setSelected((prev) => {
      const next = prev.includes(abbr) ? prev.filter((a) => a !== abbr) : [...prev, abbr];
      writeCookie(next);
      return next;
    });
  }

  return (
    <div className="container">
      <h1><img src="/favicon-32x32.png" alt="" width="24" height="24" />TRC Yoga</h1>
      <LocationChips selected={selected} onToggle={toggle} />
      <CopyLinkButton selected={selected} />
      <EventList events={events} loading={loading} error={error} />
    </div>
  );
}

export default App;
