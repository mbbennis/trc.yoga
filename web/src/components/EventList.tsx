import type { YogaEvent } from '../types.ts';
import DayGroup from './DayGroup.tsx';

interface Props {
  events: YogaEvent[];
  loading: boolean;
  error: string | null;
}

function groupByDate(events: YogaEvent[]): Map<string, YogaEvent[]> {
  const groups = new Map<string, YogaEvent[]>();
  for (const event of events) {
    const key = event.startTime.toLocaleDateString();
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return groups;
}

export default function EventList({ events, loading, error }: Props) {
  if (loading) return <p className="status">Loading events...</p>;
  if (error) return <p className="status error">{error}</p>;
  if (events.length === 0) return <p className="status">No upcoming events</p>;

  const groups = groupByDate(events);

  return (
    <div className="event-list">
      {Array.from(groups.entries()).map(([dateStr, dayEvents]) => (
        <DayGroup key={dateStr} date={dayEvents[0].startTime} events={dayEvents} />
      ))}
    </div>
  );
}
