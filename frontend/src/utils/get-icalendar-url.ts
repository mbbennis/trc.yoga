export function getICalendarUrl(locationShortNames: string[]): string {
    locationShortNames.sort();
    return `https://www.trc.yoga/calendars/${locationShortNames.join('_')}.ical`;
}
