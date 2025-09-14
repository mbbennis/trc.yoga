import ICS from 'ical.js';

import { CalendarEvent } from '@/types/CalendarEvent';
import { Location } from '@/types/Location';

import { locationService } from './BundledLocationService';

const historyICalPath = '/calendars/history.ical';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const parts = dateFormatter.formatToParts(date);
    return `${parts[0].value}-${parts[2].value}-${parts[4].value} ${parts[6].value}:${parts[8].value}`;
}

function removeLastSentences(str: string, toRemove: number): string {
    if (toRemove <= 0) return str;

    // Split by sentence endings (., !, ?), keeping punctuation
    const sentenceRegex = /([^.!?]+[.!?])/g;
    const sentences = str.match(sentenceRegex);

    if (!sentences) return str; // No sentences found

    const trimmed = sentences
        .slice(0, sentences.length - toRemove)
        .map((s) => s.trim())
        .join(' ');

    return trimmed;
}

function cleanDescription(description: string): string {
    description = description.replace('\\,', ',');
    description = description.replace(/&amp;nbsp;/g, '\u00A0');
    description = description.replace(/&amp;rsquo;/g, "'");
    description = description.replace(/&amp;#39;/g, "'");
    description = description.replace(/&amp;rdquo;/g, '"');
    description = description.replace(/&amp;ldquo;/g, '"');
    description = removeLastSentences(description, 2);
    return description;
}

function toCalendarEvent(event: ICS.Event, location: Location): CalendarEvent {
    const [title, person] = event.summary.split(' | ');
    const description = cleanDescription(event.description);
    const startDate = formatDate(event.startDate.toJSDate());
    const endDate = formatDate(event.endDate.toJSDate());

    return {
        id: event.uid,
        calendarId: location.shortName,
        calendarUrl: location.calendarUrl,
        gymName: location.name,
        location: location.address,
        title: title,
        description: description,
        person: person,
        start: startDate,
        end: endDate,
    };
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
    try {
        const response = await fetch(historyICalPath);
        const icalData = await response.text();
        const parsedCalendar = ICS.parse(icalData);
        const component = new ICS.Component(parsedCalendar);
        const vevents = component.getAllSubcomponents('vevent');

        const calendarEvents = vevents.map((vevent: ICS.Component[]) => {
            const e = new ICS.Event(vevent);
            const loc = locationService.getLocationByAddress(e.location);
            if (loc) {
                return toCalendarEvent(e, loc);
            }
        });

        return calendarEvents;
    } catch (error) {
        console.error('Error fetching iCalendar file:', error);
        return [];
    }
}
