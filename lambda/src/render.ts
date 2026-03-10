/**
 * Render Lambda — queries DynamoDB for upcoming events, renders HTML pages
 * using Eta templates, and uploads static HTML to S3 at v2/.
 */
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Eta } from "eta";
import { extractOfferingUrl } from "./capacity";
import { PAGE_TEMPLATE } from "./render-templates";

const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});
const eta = new Eta();

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const S3_BUCKET = process.env.S3_BUCKET!;
const ICAL_SOURCES: Record<string, { url: string; name: string }> = JSON.parse(process.env.ICAL_SOURCES ?? "{}");

const LOCATIONS = [
  { abbr: "MV", name: "Morrisville", color: "#6B5FBF", colorLight: "#EEEAF8" },
  { abbr: "NR", name: "North Raleigh", color: "#4A9B7F", colorLight: "#E6F4EF" },
  { abbr: "SY", name: "Salvage Yard", color: "#B83A3A", colorLight: "#FAEEE9" },
  { abbr: "D", name: "Durham", color: "#C98A2E", colorLight: "#FAF0DC" },
];

interface EventItem {
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  locationName: string;
  rawVevent: string;
  category: "yoga" | "fitness";
  instructor?: string;
  description?: string;
  improvedDescription?: string;
  soldOut?: boolean;
}

interface RenderEvent {
  uid: string;
  title: string;
  timeRange: string;
  locationAbbr: string;
  locationName: string;
  color: string;
  description: string;
  url: string;
  soldOut: boolean;
  hasDetails: boolean;
  startTime: string;
  category: string;
  instructor: string;
}

interface DayGroup {
  label: string;
  dateShort: string;
  dateKey: string;
  events: RenderEvent[];
}

// ---------- Helpers (exported for testing) ----------

const TZ = "America/New_York";

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function formatDayLabel(isoString: string, now: Date): string {
  const date = new Date(isoString);

  const targetFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const nowFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

  const targetDate = targetFormatter.format(date);
  const todayDate = nowFormatter.format(now);

  // Calculate tomorrow
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDate = nowFormatter.format(tomorrow);

  if (targetDate === todayDate) return "Today";
  if (targetDate === tomorrowDate) return "Tomorrow";

  // Compute day offset using date-only strings (avoids DST issues)
  const diffDays = Math.round(
    (new Date(targetDate).getTime() - new Date(todayDate).getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TZ }).format(date);
  return diffDays >= 8 ? `Next ${weekday}` : weekday;
}

export function formatSyncedAt(isoString: string, now: Date): string {
  const sync = new Date(isoString);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

  const syncDate = fmt(sync);
  const todayDate = fmt(now);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDate = fmt(yesterday);

  const timeStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(sync);

  if (syncDate === todayDate) return `Synced ${timeStr}`;
  if (syncDate === yesterdayDate) return `Synced yesterday at ${timeStr}`;
  return `Synced ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ }).format(sync)} at ${timeStr}`;
}

export function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function dateKey(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Build a reverse map from locationName → abbreviation. */
function buildLocationNameToAbbrev(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [abbrev, { name }] of Object.entries(ICAL_SOURCES)) {
    map[name] = abbrev;
  }
  return map;
}

function locationColor(abbr: string): string {
  return LOCATIONS.find((l) => l.abbr === abbr)?.color ?? "#888";
}

function locationShortName(abbr: string): string {
  return LOCATIONS.find((l) => l.abbr === abbr)?.name ?? abbr;
}

function parseItem(item: Record<string, { S?: string; BOOL?: boolean }>): EventItem {
  return {
    uid: item.uid?.S ?? "",
    title: item.title?.S ?? "",
    startTime: item.startTime?.S ?? "",
    endTime: item.endTime?.S ?? "",
    location: item.location?.S ?? "",
    locationName: item.locationName?.S ?? "",
    rawVevent: item.rawVevent?.S ?? "",
    category: (item.category?.S === "yoga" ? "yoga" : "fitness") as "yoga" | "fitness",
    instructor: item.instructor?.S,
    description: item.description?.S,
    improvedDescription: item.improvedDescription?.S,
    soldOut: item.soldOut?.BOOL,
  };
}

export function groupByDay(events: RenderEvent[], now: Date): DayGroup[] {
  const groups = new Map<string, RenderEvent[]>();

  for (const event of events) {
    const key = dateKey(event.startTime);
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  const days: DayGroup[] = [];
  for (const [key, dayEvents] of groups) {
    const label = formatDayLabel(dayEvents[0].startTime, now);
    days.push({
      dateKey: key,
      label,
      dateShort: formatDateShort(dayEvents[0].startTime),
      events: dayEvents,
    });
  }

  return days;
}

// ---------- Handler ----------

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const abbrevs = Object.keys(ICAL_SOURCES);
  if (abbrevs.length === 0) {
    console.error("ICAL_SOURCES is empty");
    return { statusCode: 400, body: "ICAL_SOURCES not configured" };
  }

  const nameToAbbrev = buildLocationNameToAbbrev();
  const now = new Date();
  const cutoff = now.toISOString();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const endStr = twoWeeksLater.toISOString();

  console.log(`Querying events from ${cutoff} to ${endStr}`);

  // Query GSI for each location
  const allEvents: EventItem[] = [];

  for (const [, { name }] of Object.entries(ICAL_SOURCES)) {
    let lastKey: Record<string, { S: string }> | undefined;

    do {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLE,
          IndexName: "locationName-startTime-index",
          KeyConditionExpression: "locationName = :name AND startTime BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":name": { S: name },
            ":start": { S: cutoff },
            ":end": { S: endStr },
          },
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of result.Items ?? []) {
        allEvents.push(parseItem(item as Record<string, { S?: string; BOOL?: boolean }>));
      }

      lastKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined;
    } while (lastKey);
  }

  console.log(`Found ${allEvents.length} total events`);

  // Build render events
  const renderEvents: RenderEvent[] = allEvents.map((event) => {
    const abbr = nameToAbbrev[event.locationName] ?? "";
    const offeringUrl = extractOfferingUrl(event.rawVevent);
    const description = event.improvedDescription ?? event.description ?? "";
    const url = offeringUrl ?? "";

    return {
      uid: event.uid,
      title: event.title,
      timeRange: `${formatTime(event.startTime)} \u2013 ${formatTime(event.endTime)}`,
      locationAbbr: abbr,
      locationName: locationShortName(abbr),
      color: locationColor(abbr),
      description,
      url,
      soldOut: event.soldOut === true,
      hasDetails: !!(description || url),
      startTime: event.startTime,
      category: event.category,
      instructor: event.instructor ?? "",
    };
  });

  // Sort by startTime
  renderEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const days = groupByDay(renderEvents, now);

  const categories = [
    { id: "yoga", name: "Yoga", color: "#6B5FBF" },
    { id: "fitness", name: "Fitness", color: "#C1694F" },
  ];

  const html = eta.renderString(PAGE_TEMPLATE, {
    title: "TRC Yoga",
    categories,
    locations: LOCATIONS,
    days,
    syncedAt: formatSyncedAt(now.toISOString(), now),
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: "v2/index.html",
      Body: html,
      ContentType: "text/html; charset=utf-8",
      CacheControl: "public, max-age=300",
    })
  );

  console.log(`Wrote s3://${S3_BUCKET}/v2/index.html (${renderEvents.length} events, ${days.length} days)`);

  const summary = `Rendered 1 HTML page to s3://${S3_BUCKET}/v2/`;
  console.log(summary);
  return { statusCode: 200, body: summary };
}
