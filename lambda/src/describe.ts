/**
 * Describe Lambda — consumes SQS messages from ingest, uses Bedrock (Nova Micro)
 * to rewrite event descriptions into concise summaries, and stores enriched
 * event records in DynamoDB.
 */
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { SQSEvent, SQSBatchResponse } from "aws-lambda";

const dynamo = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;
const MODEL_ID = "amazon.nova-micro-v1:0";

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
 * Classify a VEVENT as "yoga" or "fitness" based on its SUMMARY, DESCRIPTION,
 * or LOCATION fields. Events mentioning "run club" are always fitness;
 * otherwise events mentioning "yoga" are yoga; everything else is fitness.
 */
export function classifyEvent(vevent: string): "yoga" | "fitness" {
  const pattern = /^(SUMMARY|DESCRIPTION|LOCATION)[;:](.*)$/im;
  const unfolded = unfold(vevent);

  let hasYoga = false;
  for (const line of unfolded) {
    const match = line.match(pattern);
    if (match) {
      const value = match[2].toLowerCase();
      if (value.includes("run club")) return "fitness";
      if (value.includes("yoga")) hasYoga = true;
    }
  }
  return hasYoga ? "yoga" : "fitness";
}

export function buildPrompt(summary: string, description: string): string {
  return [
    "Rewrite the following yoga class description into a concise, one-to-two sentence summary.",
    "Focus only on what the class involves (style, intensity, techniques).",
    "Use third person. Omit all signup instructions, administrative details, cancellation policies, and instructor bios.",
    "",
    `Class name: ${summary}`,
    "",
    `Original description:`,
    description,
  ].join("\n");
}

async function improveDescription(summary: string, description: string): Promise<string> {
  const prompt = buildPrompt(summary, description);

  const body = JSON.stringify({
    inferenceConfig: { maxTokens: 256, temperature: 0.3 },
    messages: [{ role: "user", content: [{ text: prompt }] }],
  });

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.output.message.content[0].text.trim();
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const msg = JSON.parse(record.body) as {
      uid: string;
      startTime: string;
      endTime?: string;
      title?: string;
      description?: string;
      contentHash?: string;
      location: string;
      locationName: string;
      address: string;
      url: string;
      rawVevent: string;
    };

    try {
      let improvedDescription: string | undefined;
      if (msg.description) {
        improvedDescription = await improveDescription(msg.title ?? "", msg.description);
        console.log(`Described ${msg.uid} (${msg.startTime}): ${improvedDescription.slice(0, 80)}...`);
      } else {
        console.log(`No description for ${msg.uid} (${msg.startTime}), skipping Bedrock`);
      }

      // TTL: 1 year from now (epoch seconds)
      const ttl = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const now = new Date().toISOString();

      const category = classifyEvent(msg.rawVevent);

      const item: Record<string, { S: string } | { N: string }> = {
        // Keys
        uid: { S: msg.uid },
        startTime: { S: msg.startTime },
        // Event details
        category: { S: category },
        // Location
        location: { S: msg.location },
        locationName: { S: msg.locationName },
        address: { S: msg.address },
        url: { S: msg.url },
        // Raw source
        rawVevent: { S: msg.rawVevent },
        // Metadata
        ttl: { N: String(ttl) },
        createdAt: { S: now },
        lastModified: { S: now },
      };

      if (msg.endTime) item.endTime = { S: msg.endTime };
      if (msg.title) item.title = { S: msg.title };
      if (msg.description) item.description = { S: msg.description };
      if (improvedDescription) item.improvedDescription = { S: improvedDescription };
      if (msg.contentHash) item.contentHash = { S: msg.contentHash };

      await dynamo.send(
        new PutItemCommand({
          TableName: DYNAMODB_TABLE,
          Item: item,
        })
      );
    } catch (err) {
      console.error(`Error processing ${msg.uid} (${msg.startTime}):`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  console.log(
    `SQS batch: ${event.Records.length} records, ${batchItemFailures.length} failures`
  );

  return { batchItemFailures };
}
