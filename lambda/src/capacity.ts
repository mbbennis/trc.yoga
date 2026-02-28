/**
 * Capacity Lambda — queries DynamoDB for upcoming events, fetches each offering's
 * RockGymPro page to check availability, and updates events with sold-out status.
 */
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const dynamo = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const ICAL_SOURCES: Record<string, { url: string; name: string }> = JSON.parse(process.env.ICAL_SOURCES ?? "{}");
const HTTP_DELAY_MS = Number(process.env.HTTP_DELAY_MS ?? "1000");

interface EventItem {
  uid: string;
  startTime: string;
  locationName: string;
  rawVevent: string;
  soldOut?: boolean;
}

interface DateInfo {
  sold_out: boolean;
  session_number: number;
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

export function utcToLocalDate(startTime: string, timeZone = "America/New_York"): string {
  // Parse ISO 8601 format "2026-03-17T14:00:00.000Z"
  const utcDate = new Date(startTime);

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

  const nowStr = now.toISOString();
  const endStr = threeWeeksLater.toISOString();

  const items: EventItem[] = [];
  let lastKey: Record<string, { S: string }> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: DYNAMODB_TABLE,
        IndexName: "locationName-startTime-index",
        KeyConditionExpression: "locationName = :name AND startTime BETWEEN :start AND :end",
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
        startTime: item.startTime?.S ?? "",
        locationName: item.locationName?.S ?? "",
        rawVevent: item.rawVevent?.S ?? "",
        soldOut: item.soldOut?.BOOL,
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
  let changedCount = 0;
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
      const localDate = utcToLocalDate(event.startTime);
      const dateInfo = datesData[localDate];
      if (!dateInfo) continue;

      const soldOutChanged = event.soldOut !== dateInfo.sold_out;
      if (soldOutChanged) {
        changedCount++;
      }

      try {
        await dynamo.send(
          new UpdateItemCommand({
            TableName: DYNAMODB_TABLE,
            Key: {
              uid: { S: event.uid },
              startTime: { S: event.startTime },
            },
            UpdateExpression: "SET soldOut = :so, lastModified = :ts",
            ExpressionAttributeValues: {
              ":so": { BOOL: dateInfo.sold_out },
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

  // 5. If any soldOut status changed, emit EventBridge event to trigger calendar regeneration
  if (changedCount > 0) {
    console.log(`${changedCount} events changed soldOut status, emitting calendar-update event`);
    try {
      await eventBridge.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: "trc-yoga.capacity",
              DetailType: "CapacityChanged",
              Detail: JSON.stringify({ changedCount }),
            },
          ],
        })
      );
      console.log("EventBridge event emitted successfully");
    } catch (err) {
      console.error("Failed to emit EventBridge event:", err);
    }
  }

  const summary = `Updated ${updatedCount} events (${changedCount} changed), ${errorCount} errors`;
  console.log(summary);
  return { statusCode: 200, body: summary };
}
