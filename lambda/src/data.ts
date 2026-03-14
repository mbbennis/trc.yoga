/**
 * Data Lambda — queries DynamoDB for upcoming events, extracts key fields, and
 * writes a JSON file to S3 at data/events.json. The lookahead window is
 * configurable via the LOOKAHEAD_DAYS environment variable (default: 15).
 */
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { extractOfferingUrl } from "./capacity";

const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const S3_BUCKET = process.env.S3_BUCKET!;
const ICAL_SOURCES: Record<string, { url: string; name: string }> = JSON.parse(process.env.ICAL_SOURCES ?? "{}");
const LOOKAHEAD_DAYS = Number(process.env.LOOKAHEAD_DAYS ?? "15");

interface EventRecord {
  title: string | null;
  instructor: string | null;
  startTime: string;
  endTime: string | null;
  description: string | null;
  soldOut: boolean;
  locationName: string;
  url: string | null;
}

interface DataFile {
  timestamp: string;
  yoga: EventRecord[];
  fitness: EventRecord[];
}

function parseEvent(item: Record<string, { S?: string; BOOL?: boolean }>): {
  event: EventRecord;
  category: "yoga" | "fitness";
} {
  const rawVevent = item.rawVevent?.S ?? "";
  const offeringUrl = extractOfferingUrl(rawVevent);

  return {
    event: {
      title: item.title?.S ?? null,
      instructor: item.instructor?.S ?? null,
      startTime: item.startTime?.S ?? "",
      endTime: item.endTime?.S ?? null,
      description: item.improvedDescription?.S ?? item.description?.S ?? null,
      soldOut: item.soldOut?.BOOL ?? false,
      locationName: item.locationName?.S ?? "",
      url: offeringUrl ?? item.url?.S ?? null,
    },
    category: item.category?.S === "yoga" ? "yoga" : "fitness",
  };
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const abbrevs = Object.keys(ICAL_SOURCES);
  if (abbrevs.length === 0) {
    console.error("ICAL_SOURCES is empty");
    return { statusCode: 400, body: "ICAL_SOURCES not configured" };
  }

  const now = new Date();
  const startStr = now.toISOString();
  const endStr = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Querying events from ${startStr} to ${endStr} for ${abbrevs.length} locations`);

  const yoga: EventRecord[] = [];
  const fitness: EventRecord[] = [];

  for (const [abbrev, { name }] of Object.entries(ICAL_SOURCES)) {
    let lastKey: Record<string, { S: string }> | undefined;

    do {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLE,
          IndexName: "locationName-startTime-index",
          KeyConditionExpression: "locationName = :name AND startTime BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":name": { S: name },
            ":start": { S: startStr },
            ":end": { S: endStr },
          },
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of result.Items ?? []) {
        const { event, category } = parseEvent(item as Record<string, { S?: string; BOOL?: boolean }>);
        if (category === "yoga") yoga.push(event);
        else fitness.push(event);
      }

      lastKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined;
    } while (lastKey);

    console.log(`${abbrev} (${name}): queried`);
  }

  yoga.sort((a, b) => a.startTime.localeCompare(b.startTime));
  fitness.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const data: DataFile = {
    timestamp: now.toISOString(),
    yoga,
    fitness,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: "data/events.json",
      Body: JSON.stringify(data),
      ContentType: "application/json",
    })
  );

  const summary = `Wrote data/events.json: ${yoga.length} yoga, ${fitness.length} fitness events`;
  console.log(summary);
  return { statusCode: 200, body: summary };
}
