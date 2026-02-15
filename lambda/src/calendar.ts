/**
 * Calendar Lambda — queries DynamoDB for recent events, generates .ics files for
 * every combination of locations (power set), and writes them to S3. Each VEVENT
 * is enriched with improved descriptions, addresses, offering URLs, sold-out
 * status, and capacity check timestamps.
 */
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { extractOfferingUrl } from "./capacity";

const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const S3_BUCKET = process.env.S3_BUCKET!;
const ICAL_SOURCES: Record<string, { url: string; name: string }> = JSON.parse(process.env.ICAL_SOURCES ?? "{}");

interface EventItem {
  uid: string;
  dtstart: string;
  location: string;
  locationName: string;
  rawVevent: string;
  category: "yoga" | "fitness";
  address?: string;
  url?: string;
  improvedDescription?: string;
  description?: string;
  soldOut?: boolean;
  capacityCheckedAt?: string;
}

/**
 * Return all non-empty subsets of the given items.
 * Each subset is sorted alphabetically.
 */
export function powerSet(items: string[]): string[][] {
  const sorted = [...items].sort();
  const result: string[][] = [];
  const n = sorted.length;
  // Iterate from 1 to 2^n - 1 (skip empty set)
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset: string[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        subset.push(sorted[i]);
      }
    }
    result.push(subset);
  }
  return result;
}

/**
 * Replace or insert a field in a raw VEVENT string.
 * Handles unfolded continuation lines. If the field doesn't exist, inserts it
 * before END:VEVENT. Values are iCal-escaped.
 */
export function replaceVeventField(rawVevent: string, fieldName: string, value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

  const pattern = new RegExp(`^${fieldName}[;:]`, "i");
  const lines = rawVevent.split(/\r?\n/);
  const output: string[] = [];
  let inField = false;
  let replaced = false;

  for (const line of lines) {
    if (inField) {
      if (line.startsWith(" ") || line.startsWith("\t")) {
        continue;
      }
      inField = false;
    }

    if (!inField && pattern.test(line)) {
      output.push(`${fieldName}:${escaped}`);
      inField = true;
      replaced = true;
      continue;
    }

    if (!replaced && line.trim() === "END:VEVENT") {
      output.push(`${fieldName}:${escaped}`);
      replaced = true;
    }

    output.push(line);
  }

  return output.join("\r\n");
}

export function replaceDescription(rawVevent: string, value: string): string {
  return replaceVeventField(rawVevent, "DESCRIPTION", value);
}

export function replaceLocation(rawVevent: string, value: string): string {
  return replaceVeventField(rawVevent, "LOCATION", value);
}

/**
 * Wrap an array of VEVENT strings in a VCALENDAR envelope.
 */
export function buildIcalFile(vevents: string[], calendarName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//yoga-calendar//EN",
    `X-WR-CALNAME:${calendarName}`,
    ...vevents,
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

function parseItem(item: Record<string, { S?: string; BOOL?: boolean }>): EventItem {
  return {
    uid: item.uid?.S ?? "",
    dtstart: item.dtstart?.S ?? "",
    location: item.location?.S ?? "",
    locationName: item.locationName?.S ?? "",
    rawVevent: item.rawVevent?.S ?? "",
    category: (item.category?.S === "yoga" ? "yoga" : "fitness") as "yoga" | "fitness",
    address: item.address?.S,
    url: item.url?.S,
    improvedDescription: item.improvedDescription?.S,
    description: item.description?.S,
    soldOut: item.soldOut?.BOOL,
    capacityCheckedAt: item.capacityCheckedAt?.S,
  };
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const abbrevs = Object.keys(ICAL_SOURCES);
  if (abbrevs.length === 0) {
    console.error("ICAL_SOURCES is empty");
    return { statusCode: 400, body: "ICAL_SOURCES not configured" };
  }

  // Cutoff: 30 days ago in the same format as dtstart (YYYYMMDD...)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoffStr =
    cutoff.getUTCFullYear().toString() +
    String(cutoff.getUTCMonth() + 1).padStart(2, "0") +
    String(cutoff.getUTCDate()).padStart(2, "0") +
    "T000000";

  console.log(`Querying events since ${cutoffStr} for ${abbrevs.length} locations`);

  // Query GSI for each location
  const eventsByAbbrev: Record<string, EventItem[]> = {};

  for (const [abbrev, { name }] of Object.entries(ICAL_SOURCES)) {
    const items: EventItem[] = [];
    let lastKey: Record<string, { S: string }> | undefined;

    do {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLE,
          IndexName: "locationName-dtstart-index",
          KeyConditionExpression: "locationName = :name AND dtstart >= :cutoff",
          ExpressionAttributeValues: {
            ":name": { S: name },
            ":cutoff": { S: cutoffStr },
          },
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of result.Items ?? []) {
        items.push(parseItem(item as Record<string, { S?: string; BOOL?: boolean }>));
      }

      lastKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined;
    } while (lastKey);

    eventsByAbbrev[abbrev] = items;
    console.log(`${abbrev} (${name}): ${items.length} events`);
  }

  // Generate power set of abbreviations
  const subsets = powerSet(abbrevs);
  const categories = ["yoga", "fitness"] as const;
  console.log(`Generating ${subsets.length} .ics files per category (${categories.join(", ")})`);

  let filesWritten = 0;

  for (const subset of subsets) {
    // Merge events from all locations in this subset
    const merged: EventItem[] = [];
    for (const abbrev of subset) {
      merged.push(...(eventsByAbbrev[abbrev] ?? []));
    }

    // Calendar name from location names, stripping the "Triangle Rock Club - " prefix
    const calName = subset
      .map((abbrev) => (ICAL_SOURCES[abbrev]?.name ?? abbrev).replace(/^Triangle Rock Club - /i, ""))
      .join(", ");

    // Write one file per category
    for (const category of categories) {
      const catEvents = merged.filter((e) => e.category === category);

      const vevents = catEvents.map((event) => {
        let vevent = event.rawVevent;
        if (event.improvedDescription) {
          vevent = replaceDescription(vevent, event.improvedDescription);
        }
        if (event.address) {
          vevent = replaceLocation(vevent, event.address);
        }
        const offeringUrl = extractOfferingUrl(event.rawVevent);
        if (offeringUrl) {
          vevent = replaceVeventField(vevent, "URL", offeringUrl);
        } else if (event.url) {
          vevent = replaceVeventField(vevent, "URL", event.url);
        }
        if (event.soldOut !== undefined) {
          vevent = replaceVeventField(vevent, "X-SOLD-OUT", event.soldOut ? "TRUE" : "FALSE");
        }
        if (event.capacityCheckedAt) {
          vevent = replaceVeventField(vevent, "X-CAPACITY-CHECKED-AT", event.capacityCheckedAt);
        }
        const shortName = event.locationName.replace(/^Triangle Rock Club - /i, "");
        vevent = replaceVeventField(vevent, "CATEGORIES", shortName);
        return vevent;
      });

      const icsContent = buildIcalFile(vevents, calName);
      const key = `calendars/${category}/${subset.join("_")}.ics`;

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: icsContent,
          ContentType: "text/calendar",
        })
      );

      filesWritten++;
    }
  }

  const summary = `Wrote ${filesWritten} .ics files to s3://${S3_BUCKET}/calendars/`;
  console.log(summary);
  return { statusCode: 200, body: summary };
}
