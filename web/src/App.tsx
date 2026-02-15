import { useCallback, useState, useSyncExternalStore } from 'react';
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

// Minimal client-side router via pushState + popstate
function usePath(): [string, (to: string) => void] {
  const path = useSyncExternalStore(
    (cb) => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); },
    () => window.location.pathname,
  );

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return [path, navigate];
}

function categoryFromPath(path: string): 'yoga' | 'fitness' {
  return path === '/fitness' || path === '/fitness/' ? 'fitness' : 'yoga';
}

function App() {
  const [path, navigate] = usePath();
  const category = categoryFromPath(path);

  const [selected, setSelected] = useState<string[]>(
    () => readCookie() ?? allAbbrs,
  );

  const { events, loading, error } = useEvents(selected, category);

  function toggle(abbr: string) {
    setSelected((prev) => {
      const next = prev.includes(abbr) ? prev.filter((a) => a !== abbr) : [...prev, abbr];
      writeCookie(next);
      return next;
    });
  }

  const title = category === 'fitness' ? 'TRC Fitness' : 'TRC Yoga';
  const otherLabel = category === 'fitness' ? 'View Yoga classes' : 'View Fitness classes';
  const otherHref = category === 'fitness' ? '/' : '/fitness';


  return (
    <div className="container">
      <h1><img src="/favicon-32x32.png" alt="" width="24" height="24" />{title}</h1>
      <nav className="page-nav">
        <a href={otherHref} onClick={(e) => { e.preventDefault(); navigate(otherHref); }}>
          {otherLabel}
        </a>
      </nav>
      <LocationChips selected={selected} onToggle={toggle} />
      <CopyLinkButton selected={selected} category={category} />
      <EventList events={events} loading={loading} error={error} />
    </div>
  );
}

export default App;
