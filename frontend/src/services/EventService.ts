import ICS from 'ical.js';

import locations from '@/assets/locations.json';
import { CalendarEvent } from '@/types/CalendarEvent';

const fullICalPath = '/calendars/D_MV_NR_SY.ical';
const locationMap: Map<string, object> = new Map(
    locations.map((l) => [l.address, l]),
);
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

export function getICalendarUrl(locationShortNames: string[]): string {
    locationShortNames.sort();
    return `https://www.trc.yoga/calendars/${locationShortNames.join('_')}.ical`;
}

function getLocationData(address: string) {
    return locationMap.get(address);
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const parts = dateFormatter.formatToParts(date);
    return `${parts[0].value}-${parts[2].value}-${parts[4].value} ${parts[6].value}:${parts[8].value}`;
}

function trimLastSentances(str: string, toRemove: number): string {
    const parts = str.split('.').slice(0);
    return parts.slice(0, parts.length - toRemove - 1).join('.') + '.';
}

export function cleanDescription(description: string): string {
    description = description.replace(',', ',');
    description = description.replace(/&amp;nbsp;/g, '\u00A0');
    description = description.replace(/&amp;rsquo;/g, "'");
    description = description.replace(/&amp;#39;/g, "'");
    description = description.replace(/&amp;rdquo;/g, '"');
    description = description.replace(/&amp;ldquo;/g, '"');
    description = trimLastSentances(description, 2);
    return description;
}

function toCalendarEvent(event: ICS.Event, id: number): CalendarEvent {
    const [title, person] = event.summary.split(' | ');
    const description = cleanDescription(event.description);
    const startDate = formatDate(event.startDate.toJSDate());
    const endDate = formatDate(event.endDate.toJSDate());
    const { shortName, name, calendarUrl } = getLocationData(event.location);

    return {
        id: id,
        calendarId: shortName,
        calendarUrl: calendarUrl,
        title: title,
        gymName: name,
        location: event.location,
        description: description,
        person: person,
        start: startDate,
        end: endDate,
    };
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
    try {
        const response = await fetch(fullICalPath);
        const icalData = await response.text();
        const parsedCalendar = ICS.parse(icalData);
        const component = new ICS.Component(parsedCalendar);
        const vevents = component.getAllSubcomponents('vevent');

        let id = 0;
        const calendarEvents = vevents.map((vevent) => {
            const e = new ICS.Event(vevent);
            return toCalendarEvent(e, id++);
        });

        return calendarEvents;
    } catch (error) {
        console.error('Error fetching iCalendar file:', error);
    }
}
