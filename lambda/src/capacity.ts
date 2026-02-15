/**
 * Capacity Lambda — queries DynamoDB for upcoming events, fetches each offering's
 * RockGymPro page to check availability, and updates events with sold-out status
 * and a capacityCheckedAt timestamp.
 */
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const ICAL_SOURCES: Record<string, { url: string; name: string }> = JSON.parse(process.env.ICAL_SOURCES ?? "{}");
const HTTP_DELAY_MS = Number(process.env.HTTP_DELAY_MS ?? "1000");

interface EventItem {
  uid: string;
  dtstart: string;
  locationName: string;
  rawVevent: string;
}

interface DateInfo {
  sold_out: boolean;
  session_number: number;
  is_available: boolean;
  specific_datetimes: string[];
}

// ---------- Pure functions (exported for testing) ----------

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractOfferingUrl(rawVevent: string): string | undefined {
  const lines = rawVevent.split(/\r?\n/);
  let urlValue: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^URL[;:]/i.test(line)) {
      const colonIdx = line.indexOf(":", 3);
      if (colonIdx === -1) continue;
      urlValue = line.slice(colonIdx + 1);
      // Handle folded continuation lines
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith(" ") || lines[j].startsWith("\t")) {
          urlValue += lines[j].slice(1);
        } else {
          break;
        }
      }
      break;
    }
  }

  if (!urlValue) return undefined;

  const decoded = decodeHtmlEntities(urlValue.trim());
  if (!decoded.includes("offering_guid")) return undefined;

  // Swap mode=e to mode=p for the public/standalone page
  return decoded.replace(/([?&])mode=e\b/, "$1mode=p");
}

export function extractOfferingGuid(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("offering_guid") ?? undefined;
  } catch {
    return undefined;
  }
}

export function parseDatesData(html: string): Record<string, DateInfo> | undefined {
  const match = html.match(/var\s+dates_data\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

export function utcToLocalDate(dtstart: string, timeZone = "America/New_York"): string {
  // Parse "20260317T140000Z" format
  const year = parseInt(dtstart.slice(0, 4), 10);
  const month = parseInt(dtstart.slice(4, 6), 10) - 1;
  const day = parseInt(dtstart.slice(6, 8), 10);
  const hour = parseInt(dtstart.slice(9, 11), 10);
  const minute = parseInt(dtstart.slice(11, 13), 10);
  const second = parseInt(dtstart.slice(13, 15), 10);

  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(utcDate);
}

// ---------- Handler ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryUpcomingEvents(locationName: string): Promise<EventItem[]> {
  const now = new Date();
  const threeWeeksLater = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  const nowStr =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    "T000000";

  const endStr =
    threeWeeksLater.getUTCFullYear().toString() +
    String(threeWeeksLater.getUTCMonth() + 1).padStart(2, "0") +
    String(threeWeeksLater.getUTCDate()).padStart(2, "0") +
    "T235959";

  const items: EventItem[] = [];
  let lastKey: Record<string, { S: string }> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: DYNAMODB_TABLE,
        IndexName: "locationName-dtstart-index",
        KeyConditionExpression: "locationName = :name AND dtstart BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":name": { S: locationName },
          ":start": { S: nowStr },
          ":end": { S: endStr },
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      items.push({
        uid: item.uid?.S ?? "",
        dtstart: item.dtstart?.S ?? "",
        locationName: item.locationName?.S ?? "",
        rawVevent: item.rawVevent?.S ?? "",
      });
    }

    lastKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined;
  } while (lastKey);

  return items;
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const locations = Object.values(ICAL_SOURCES);
  if (locations.length === 0) {
    console.error("ICAL_SOURCES is empty");
    return { statusCode: 400, body: "ICAL_SOURCES not configured" };
  }

  // 1. Query all upcoming events across locations
  const allEvents: EventItem[] = [];
  for (const { name } of locations) {
    const events = await queryUpcomingEvents(name);
    console.log(`${name}: ${events.length} upcoming events`);
    allEvents.push(...events);
  }

  if (allEvents.length === 0) {
    console.log("No upcoming events found");
    return { statusCode: 200, body: "No upcoming events" };
  }

  // 2. Group events by offering_guid
  const byOffering = new Map<string, EventItem[]>();
  let skippedNoUrl = 0;

  for (const event of allEvents) {
    const offeringUrl = extractOfferingUrl(event.rawVevent);
    if (!offeringUrl) {
      skippedNoUrl++;
      continue;
    }
    const guid = extractOfferingGuid(offeringUrl);
    if (!guid) {
      skippedNoUrl++;
      continue;
    }

    const existing = byOffering.get(guid);
    if (existing) {
      existing.push(event);
    } else {
      byOffering.set(guid, [event]);
    }
  }

  if (skippedNoUrl > 0) {
    console.warn(`Skipped ${skippedNoUrl} events with missing/invalid offering URL`);
  }

  console.log(`${byOffering.size} unique offerings to check`);

  // 3. Fetch each offering page and update events
  let updatedCount = 0;
  let errorCount = 0;
  let isFirst = true;

  for (const [guid, events] of byOffering) {
    // Rate limit between requests
    if (!isFirst) {
      await sleep(HTTP_DELAY_MS);
    }
    isFirst = false;

    const offeringUrl = extractOfferingUrl(events[0].rawVevent)!;

    let html: string;
    try {
      const res = await fetch(offeringUrl);
      if (!res.ok) {
        console.error(`HTTP ${res.status} fetching offering ${guid}`);
        errorCount++;
        continue;
      }
      html = await res.text();
    } catch (err) {
      console.error(`Fetch error for offering ${guid}:`, err);
      errorCount++;
      continue;
    }

    const datesData = parseDatesData(html);
    if (!datesData) {
      console.error(`Could not parse dates_data for offering ${guid}`);
      errorCount++;
      continue;
    }

    // 4. Update each event's capacity info
    for (const event of events) {
      const localDate = utcToLocalDate(event.dtstart);
      const dateInfo = datesData[localDate];
      if (!dateInfo) continue;

      try {
        await dynamo.send(
          new UpdateItemCommand({
            TableName: DYNAMODB_TABLE,
            Key: {
              uid: { S: event.uid },
              dtstart: { S: event.dtstart },
            },
            UpdateExpression: "SET soldOut = :so, isAvailable = :ia, capacityCheckedAt = :ts",
            ExpressionAttributeValues: {
              ":so": { BOOL: dateInfo.sold_out },
              ":ia": { BOOL: dateInfo.is_available },
              ":ts": { S: new Date().toISOString() },
            },
          })
        );
        updatedCount++;
      } catch (err) {
        console.error(`DynamoDB update error for ${event.uid}:`, err);
        errorCount++;
      }
    }
  }

  const summary = `Updated ${updatedCount} events, ${errorCount} errors`;
  console.log(summary);
  return { statusCode: 200, body: summary };
}
