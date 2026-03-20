import { Schedule } from "@/components/Schedule";

export const revalidate = false;

const DATA_URL = "https://data.trc.yoga/data/events.json";

interface RawEvent {
  title: string | null;
  instructor: string | null;
  startTime: string;
  endTime: string | null;
  description: string | null;
  soldOut: boolean;
  locationName: string;
  url: string | null;
}

interface RawData {
  timestamp: string;
  yoga: RawEvent[];
  fitness: RawEvent[];
}

export interface ClassEvent {
  id: string;
  name: string;
  instructor: string | null;
  time: string;
  end: string;
  date: string;        // "YYYY-MM-DD" in Eastern time — used for grouping and "today" comparisons
  location: string;    // short name e.g. "Morrisville"
  description: string | null;
  soldOut: boolean;
  url: string | null;
  category: "yoga" | "fitness";
}

function formatTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const period = parts.find((p) => p.type === "dayPeriod")?.value?.toLowerCase() ?? "";
  return `${hour}:${minute}${period}`;
}

function toEasternDate(iso: string): string {
  // Returns "YYYY-MM-DD" in Eastern time
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function transformEvent(raw: RawEvent, category: "yoga" | "fitness", index: number): ClassEvent {
  return {
    id: `${category}-${index}-${raw.startTime}`,
    name: raw.title ?? "",
    instructor: raw.instructor,
    time: formatTime(raw.startTime),
    end: raw.endTime ? formatTime(raw.endTime) : "",
    date: toEasternDate(raw.startTime),
    location: raw.locationName.replace(/^Triangle Rock Club - /i, ""),
    description: raw.description,
    soldOut: raw.soldOut,
    url: raw.url,
    category,
  };
}

export default async function Home() {
  let events: ClassEvent[] = [];
  let dataTimestamp = new Date().toISOString();

  try {
    const res = await fetch(DATA_URL, { next: { revalidate } });
    if (res.ok) {
      const data: RawData = await res.json();
      dataTimestamp = data.timestamp;
      events = [
        ...data.yoga.map((e, i) => transformEvent(e, "yoga", i)),
        ...data.fitness.map((e, i) => transformEvent(e, "fitness", i)),
      ];
    }
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }

  return <Schedule events={events} dataTimestamp={dataTimestamp} />;
}
