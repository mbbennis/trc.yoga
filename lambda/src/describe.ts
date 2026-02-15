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
      dtstart: string;
      location: string;
      locationName: string;
      rawVevent: string;
      address: string;
      url: string;
      summary?: string;
      description?: string;
      dtend?: string;
    };

    try {
      let improvedDescription: string | undefined;
      if (msg.description) {
        improvedDescription = await improveDescription(msg.summary ?? "", msg.description);
        console.log(`Described ${msg.uid} (${msg.dtstart}): ${improvedDescription.slice(0, 80)}...`);
      } else {
        console.log(`No description for ${msg.uid} (${msg.dtstart}), skipping Bedrock`);
      }

      // TTL: 1 year from now (epoch seconds)
      const ttl = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

      const item: Record<string, { S: string } | { N: string }> = {
        uid: { S: msg.uid },
        dtstart: { S: msg.dtstart },
        location: { S: msg.location },
        locationName: { S: msg.locationName },
        rawVevent: { S: msg.rawVevent },
        address: { S: msg.address },
        url: { S: msg.url },
        ttl: { N: String(ttl) },
      };

      for (const field of ["summary", "description", "dtend"] as const) {
        if (msg[field]) {
          item[field] = { S: msg[field] };
        }
      }

      if (improvedDescription) {
        item.improvedDescription = { S: improvedDescription };
      }

      await dynamo.send(
        new PutItemCommand({
          TableName: DYNAMODB_TABLE,
          Item: item,
        })
      );
    } catch (err) {
      console.error(`Error processing ${msg.uid} (${msg.dtstart}):`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  console.log(
    `SQS batch: ${event.Records.length} records, ${batchItemFailures.length} failures`
  );

  return { batchItemFailures };
}
