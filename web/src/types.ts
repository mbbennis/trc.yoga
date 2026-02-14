export interface Location {
  abbr: string;
  name: string;
  color: string;
}

export interface YogaEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: Date;
  dtend: Date;
  url?: string;
  locationAbbr: string;
}
