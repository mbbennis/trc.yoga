import { useState } from 'react';
import { LOCATIONS } from '../constants.ts';
import type { YogaEvent } from '../types.ts';

interface Props {
  event: YogaEvent;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventCard({ event }: Props) {
  const [expanded, setExpanded] = useState(false);
  const location = LOCATIONS.find((l) => l.abbr === event.locationAbbr);
  const color = location?.color ?? '#888';
  const hasDetails = !!(event.description || event.url);

  return (
    <div
      className={`event-card${expanded ? ' event-card--expanded' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={hasDetails ? () => setExpanded(!expanded) : undefined}
      role={hasDetails ? 'button' : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      onKeyDown={hasDetails ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } } : undefined}
    >
      <div className="event-card-header">
        <div className="event-card-info">
          <div className="event-time">
            {formatTime(event.startTime)} – {formatTime(event.endTime)}
          </div>
          <div className="event-summary">{event.title}</div>
        </div>
        <div className="event-badges">
          {event.soldOut && <span className="event-badge sold-out-badge">Class Full</span>}
          <span className="event-badge" style={{ backgroundColor: color }}>
            {location?.name ?? event.locationAbbr}
          </span>
        </div>
      </div>
      {expanded && (
        <div className="event-card-details">
          {event.description && (
            <div className="event-description">{event.description}</div>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="event-link"
              onClick={(e) => e.stopPropagation()}
            >
              View on website
            </a>
          )}
        </div>
      )}
    </div>
  );
}
