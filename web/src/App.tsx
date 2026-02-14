import { useState } from 'react';
import { LOCATIONS } from './constants.ts';
import { useEvents } from './hooks/useEvents.ts';
import LocationChips from './components/LocationChips.tsx';
import CopyLinkButton from './components/CopyLinkButton.tsx';
import EventList from './components/EventList.tsx';

function App() {
  const [selected, setSelected] = useState<string[]>(
    LOCATIONS.map((l) => l.abbr),
  );

  const { events, loading, error } = useEvents(selected);

  function toggle(abbr: string) {
    setSelected((prev) =>
      prev.includes(abbr) ? prev.filter((a) => a !== abbr) : [...prev, abbr],
    );
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
