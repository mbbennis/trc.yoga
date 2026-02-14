import type { YogaEvent } from '../types.ts';
import EventCard from './EventCard.tsx';

interface Props {
  date: Date;
  events: YogaEvent[];
}

function formatDayHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function DayGroup({ date, events }: Props) {
  return (
    <section className="day-group">
      <h2 className="day-header">{formatDayHeader(date)}</h2>
      {events.map((event) => (
        <EventCard key={event.uid} event={event} />
      ))}
    </section>
  );
}
