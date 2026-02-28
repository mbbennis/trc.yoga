export interface Location {
  abbr: string;
  name: string;
  color: string;
}

export interface YogaEvent {
  uid: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  url?: string;
  locationAbbr: string;
  soldOut?: boolean;
  lastModified?: string;
}
