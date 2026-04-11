/**
 * Ingest Lambda — fetches iCal feeds from configured sources, checks for
 * new/changed events via content hash, sends them to SQS for enrichment,
 * and deletes DynamoDB records that no longer exist in the feed.
 */
import { createHash } from "node:crypto";
import { DynamoDBClient, QueryCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";

const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL!;

/**
 * Extract VEVENT blocks from raw iCal text.
 * Returns an array of full "BEGIN:VEVENT...END:VEVENT" strings.
 */
export function extractVEvents(ical: string): string[] {
  const events: string[] = [];
  const lines = ical.split(/\r?\n/);
  let inside = false;
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "BEGIN:VEVENT") {
      inside = true;
      current = [line];
    } else if (line.trim() === "END:VEVENT") {
      current.push(line);
      events.push(current.join("\r\n"));
      inside = false;
      current = [];
    } else if (inside) {
      current.push(line);
    }
  }

  return events;
}

/**
 * Unfold iCal continuation lines (lines starting with space/tab are continuations).
 */
function unfold(vevent: string): string[] {
  const lines = vevent.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

/**
 * Parse a single iCal field value from a VEVENT block.
 * Handles unfolding and property parameters (e.g. DTSTART;VALUE=DATE:20240101).
 * Returns undefined if the field is not found.
 */
export function parseVEventField(vevent: string, field: string): string | undefined {
  const unfolded = unfold(vevent);
  const pattern = new RegExp(`^${field}[;:](.*)$`, "i");
  for (const line of unfolded) {
    const match = line.match(pattern);
    if (match) {
      // If the field has parameters (semicolon-separated), the value is after the last colon
      // e.g. DTSTART;VALUE=DATE:20240101 → we want "20240101"
      // But for simple fields like SUMMARY:Yoga → we want "Yoga"
      const colonIdx = line.indexOf(":", field.length);
      if (colonIdx !== -1) {
        return line.slice(colonIdx + 1);
      }
      return match[1];
    }
  }
  return undefined;
}

/**
 * Convert an iCal datetime string (e.g. "20260326T230000Z") to ISO 8601
 * (e.g. "2026-03-26T23:00:00.000Z"). Handles both with and without trailing Z.
 */
export function icalToIso(ical: string): string {
  const s = ical.replace(/Z$/, "");
  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  const hour = s.slice(9, 11);
  const minute = s.slice(11, 13);
  const second = s.slice(13, 15);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

/**
 * Parse a "Title | Instructor" summary into separate parts.
 * If the summary doesn't contain " | ", instructor is empty.
 */
export function parseTitleInstructor(summary: string): { title: string; instructor: string } {
  const sep = summary.lastIndexOf(" | ");
  if (sep === -1) return { title: summary, instructor: "" };
  return { title: summary.slice(0, sep), instructor: summary.slice(sep + 3) };
}

/**
 * Compute a SHA-256 hex digest of the raw VEVENT string for change detection.
 * Strips volatile fields that change on every fetch but don't represent
 * meaningful changes: DTSTAMP (server timestamp) and URL (contains a random
 * query parameter from RockGymPro).
 */
export function computeContentHash(vevent: string): string {
  const stable = vevent
    .split(/\r?\n/)
    .filter((line) => !/^(DTSTAMP|URL)[;:]/i.test(line))
    .join("\r\n");
  return createHash("sha256").update(stable).digest("hex");
}

async function fetchIcal(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Query DynamoDB for all upcoming events at a location via the GSI.
 * Returns a map of "uid#startTime" → { uid, startTime, rawVevent }.
 */
export async function queryUpcomingByLocation(
  locationName: string,
  nowStr: string
): Promise<Map<string, { uid: string; startTime: string; rawVevent: string }>> {
  const map = new Map<string, { uid: string; startTime: string; rawVevent: string }>();
  let lastKey: Record<string, { S: string }> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: DYNAMODB_TABLE,
        IndexName: "locationName-startTime-index",
        KeyConditionExpression: "locationName = :name AND startTime >= :now",
        ExpressionAttributeValues: {
          ":name": { S: locationName },
          ":now": { S: nowStr },
        },
        ProjectionExpression: "uid, startTime, rawVevent",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const uid = item.uid?.S ?? "";
      const startTime = item.startTime?.S ?? "";
      const rawVevent = item.rawVevent?.S ?? "";
      if (uid && startTime) {
        map.set(`${uid}#${startTime}`, { uid, startTime, rawVevent });
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined;
  } while (lastKey);

  return map;
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  // Read at invocation time so env changes take effect without a cold start
  const ICAL_SOURCES: Record<string, { url: string; name: string; address: string; siteUrl: string }> = JSON.parse(
    process.env.ICAL_SOURCES ?? "{}"
  );

  const abbrevs = Object.keys(ICAL_SOURCES);
  if (abbrevs.length === 0) {
    console.error("ICAL_SOURCES is empty — nothing to fetch");
    return { statusCode: 400, body: "ICAL_SOURCES not configured" };
  }

  console.log(`Fetching ${abbrevs.length} iCal source(s): ${abbrevs.join(", ")}`);

  const entries = Object.entries(ICAL_SOURCES);
  const results = await Promise.allSettled(entries.map(([, { url }]) => fetchIcal(url)));

  const nowStr = new Date().toISOString();
  let totalSent = 0;
  let totalDeleted = 0;

  for (let i = 0; i < results.length; i++) {
    const [abbrev, { url, name, address, siteUrl }] = entries[i];
    const result = results[i];

    if (result.status === "rejected") {
      console.error(`Error fetching ${abbrev} (${url}): ${result.reason}`);
      continue;
    }

    const vevents = extractVEvents(result.value);
    console.log(`${abbrev}: ${vevents.length} events total`);

    // Bulk query DynamoDB for all upcoming events at this location
    const existingMap = await queryUpcomingByLocation(name, nowStr);
    console.log(`${abbrev}: ${existingMap.size} upcoming events in DynamoDB`);

    // Compare feed events against DynamoDB, track which keys are seen
    const changedEvents: { vevent: string; startTime: string }[] = [];
    const seenKeys = new Set<string>();

    for (const vevent of vevents) {
      const uid = parseVEventField(vevent, "UID");
      const dtstart = parseVEventField(vevent, "DTSTART");
      if (!uid || !dtstart) continue;

      const startTime = icalToIso(dtstart);

      // Only manage upcoming events
      if (startTime < nowStr) continue;

      const key = `${uid}#${startTime}`;
      seenKeys.add(key);

      const incomingHash = computeContentHash(vevent);
      const existing = existingMap.get(key);
      const existingHash = existing?.rawVevent ? computeContentHash(existing.rawVevent) : null;

      if (existingHash === null || incomingHash !== existingHash) {
        changedEvents.push({ vevent, startTime });
      }
    }

    // Delete ghost records (in DynamoDB but not in the feed)
    const ghostKeys = [...existingMap.keys()].filter((k) => !seenKeys.has(k));
    console.log(`${abbrev}: ${ghostKeys.length} ghost events to delete, ${changedEvents.length} new/changed events to send to SQS`);

    for (const key of ghostKeys) {
      const { uid, startTime } = existingMap.get(key)!;
      await dynamo.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: { uid: { S: uid }, startTime: { S: startTime } },
        })
      );
      totalDeleted++;
    }

    // Send new/changed events to SQS in batches of 10
    for (let j = 0; j < changedEvents.length; j += 10) {
      const batch = changedEvents.slice(j, j + 10);
      const sqsEntries = batch.map(({ vevent, startTime }, idx) => {
        const uid = parseVEventField(vevent, "UID") ?? "unknown";

        const messageBody: Record<string, string> = {
          uid,
          startTime,
          location: abbrev,
          locationName: name,
          rawVevent: vevent,
          address,
          url: siteUrl,
        };

        const summaryVal = parseVEventField(vevent, "SUMMARY");
        if (summaryVal) {
          const parsed = parseTitleInstructor(summaryVal);
          messageBody.title = parsed.title;
          messageBody.instructor = parsed.instructor;
        }
        const descVal = parseVEventField(vevent, "DESCRIPTION");
        if (descVal) {
          messageBody.description = descVal;
        }
        const dtend = parseVEventField(vevent, "DTEND");
        if (dtend) {
          messageBody.endTime = icalToIso(dtend);
        }

        return {
          Id: String(j + idx),
          MessageBody: JSON.stringify(messageBody),
        };
      });

      await sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: SQS_QUEUE_URL,
          Entries: sqsEntries,
        })
      );

      totalSent += sqsEntries.length;
    }
  }

  console.log(`Sent ${totalSent} events to SQS, deleted ${totalDeleted} ghosts`);
  return {
    statusCode: 200,
    body: `Sent ${totalSent} events to SQS, deleted ${totalDeleted} ghosts`,
  };
}
