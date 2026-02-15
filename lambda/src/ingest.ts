/**
 * Ingest Lambda — fetches iCal feeds from configured sources, filters for yoga
 * events newer than the latest in DynamoDB, and sends them to SQS for enrichment.
 */
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";

const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});

// JSON map of location abbreviation → {url, name, address, siteUrl}
const ICAL_SOURCES: Record<string, { url: string; name: string; address: string; siteUrl: string }> = JSON.parse(process.env.ICAL_SOURCES ?? "{}");
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
 * Check if a VEVENT block contains the word "yoga" (case-insensitive)
 * in its SUMMARY, DESCRIPTION, or LOCATION fields.
 */
export function isYogaEvent(vevent: string): boolean {
  const pattern = /^(SUMMARY|DESCRIPTION|LOCATION)[;:](.*)$/im;
  const unfolded = unfold(vevent);

  for (const line of unfolded) {
    const match = line.match(pattern);
    if (match && match[2].toLowerCase().includes("yoga")) {
      return true;
    }
  }
  return false;
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

async function fetchIcal(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const abbrevs = Object.keys(ICAL_SOURCES);
  if (abbrevs.length === 0) {
    console.error("ICAL_SOURCES is empty — nothing to fetch");
    return { statusCode: 400, body: "ICAL_SOURCES not configured" };
  }

  console.log(`Fetching ${abbrevs.length} iCal source(s): ${abbrevs.join(", ")}`);

  // Fetch all feeds and filter for yoga events per location
  const entries = Object.entries(ICAL_SOURCES);
  const results = await Promise.allSettled(entries.map(([, { url }]) => fetchIcal(url)));

  let totalSent = 0;

  for (let i = 0; i < results.length; i++) {
    const [abbrev, { url, name, address, siteUrl }] = entries[i];
    const result = results[i];

    if (result.status === "rejected") {
      console.error(`Error fetching ${abbrev} (${url}): ${result.reason}`);
      continue;
    }

    const vevents = extractVEvents(result.value);
    const yoga = vevents.filter(isYogaEvent);
    console.log(`${abbrev}: ${vevents.length} events total, ${yoga.length} yoga events`);

    // Find the most recent dtstart already stored for this location
    const cutoffResult = await dynamo.send(
      new QueryCommand({
        TableName: DYNAMODB_TABLE,
        IndexName: "locationName-dtstart-index",
        KeyConditionExpression: "locationName = :name",
        ExpressionAttributeValues: { ":name": { S: name } },
        ScanIndexForward: false,
        Limit: 1,
        ProjectionExpression: "dtstart",
      })
    );
    const cutoff = cutoffResult.Items?.[0]?.dtstart?.S;
    if (cutoff) {
      console.log(`${abbrev}: cutoff dtstart = ${cutoff}`);
    } else {
      console.log(`${abbrev}: no existing events, writing all`);
    }

    // Only keep events newer than the cutoff
    const newYoga = cutoff
      ? yoga.filter((vevent) => {
          const dtstart = parseVEventField(vevent, "DTSTART");
          return dtstart !== undefined && dtstart > cutoff;
        })
      : yoga;

    console.log(`${abbrev}: ${newYoga.length} new events to send to SQS`);

    // SendMessageBatch in chunks of 10
    for (let j = 0; j < newYoga.length; j += 10) {
      const batch = newYoga.slice(j, j + 10);
      const entries = batch.map((vevent, idx) => {
        const uid = parseVEventField(vevent, "UID") ?? "unknown";
        const dtstart = parseVEventField(vevent, "DTSTART") ?? "unknown";

        const messageBody: Record<string, string> = {
          uid,
          dtstart,
          location: abbrev,
          locationName: name,
          rawVevent: vevent,
          address,
          url: siteUrl,
        };

        // Add optional fields if present
        for (const field of ["SUMMARY", "DESCRIPTION", "DTEND"]) {
          const value = parseVEventField(vevent, field);
          if (value) {
            messageBody[field.toLowerCase()] = value;
          }
        }

        return {
          Id: String(j + idx),
          MessageBody: JSON.stringify(messageBody),
        };
      });

      await sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: SQS_QUEUE_URL,
          Entries: entries,
        })
      );

      totalSent += entries.length;
    }
  }

  console.log(`Sent ${totalSent} yoga events to SQS`);

  return {
    statusCode: 200,
    body: `Sent ${totalSent} yoga events to SQS`,
  };
}
