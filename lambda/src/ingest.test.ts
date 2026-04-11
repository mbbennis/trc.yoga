/* eslint-disable @typescript-eslint/no-explicit-any */

// These vars must use `var` so they are hoisted above jest.mock factories,
// allowing the factories to close over them before the assignment runs.
// The indirect `(...args) => mockXSend(...args)` pattern defers evaluation
// of the variable until test call-time (after the assignment has run).
var mockDynamoSend = jest.fn();
var mockSqsSend = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  ...jest.requireActual("@aws-sdk/client-dynamodb"),
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: (...args: any[]) => mockDynamoSend(...args),
  })),
}));

jest.mock("@aws-sdk/client-sqs", () => ({
  ...jest.requireActual("@aws-sdk/client-sqs"),
  SQSClient: jest.fn().mockImplementation(() => ({
    send: (...args: any[]) => mockSqsSend(...args),
  })),
}));

import {
  extractVEvents,
  parseVEventField,
  computeContentHash,
  parseTitleInstructor,
  queryUpcomingByLocation,
  handler,
} from "./ingest";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockDynamoSend.mockReset();
  mockSqsSend.mockReset();
  mockFetch.mockReset();
  process.env.DYNAMODB_TABLE = "test-table";
  process.env.SQS_QUEUE_URL = "https://sqs.test/queue";
  process.env.ICAL_SOURCES = JSON.stringify({
    MV: {
      url: "https://example.com/mv.ics",
      name: "Triangle Rock Club - Morrisville",
      address: "1 Main St",
      siteUrl: "https://trc.com/mv",
    },
  });
});

// --------------- computeContentHash ---------------

describe("computeContentHash", () => {
  it("returns a consistent hex string for the same input", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const hash1 = computeContentHash(vevent);
    const hash2 = computeContentHash(vevent);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    const a = computeContentHash("BEGIN:VEVENT\r\nSUMMARY:Yoga A\r\nEND:VEVENT");
    const b = computeContentHash("BEGIN:VEVENT\r\nSUMMARY:Yoga B\r\nEND:VEVENT");
    expect(a).not.toBe(b);
  });

  it("ignores DTSTAMP changes", () => {
    const a = computeContentHash("BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nDTSTAMP:20260101T000000Z\r\nEND:VEVENT");
    const b = computeContentHash("BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nDTSTAMP:20260202T120000Z\r\nEND:VEVENT");
    expect(a).toBe(b);
  });

  it("ignores URL changes (volatile random parameter)", () => {
    const a = computeContentHash("BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nURL:https://example.com?random=abc123\r\nEND:VEVENT");
    const b = computeContentHash("BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nURL:https://example.com?random=xyz789\r\nEND:VEVENT");
    expect(a).toBe(b);
  });
});

// --------------- parseTitleInstructor ---------------

describe("parseTitleInstructor", () => {
  it("splits title and instructor on ' | '", () => {
    expect(parseTitleInstructor("Vinyasa Flow | Jane Smith")).toEqual({
      title: "Vinyasa Flow",
      instructor: "Jane Smith",
    });
  });

  it("returns empty instructor when no separator", () => {
    expect(parseTitleInstructor("Vinyasa Flow")).toEqual({
      title: "Vinyasa Flow",
      instructor: "",
    });
  });

  it("splits on last ' | ' only", () => {
    expect(parseTitleInstructor("Power | Yoga | Jane")).toEqual({
      title: "Power | Yoga",
      instructor: "Jane",
    });
  });
});

// --------------- extractVEvents ---------------

describe("extractVEvents", () => {
  it("extracts a single VEVENT", () => {
    const ical = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:Morning Yoga",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = extractVEvents(ical);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("SUMMARY:Morning Yoga");
  });

  it("extracts multiple VEVENTs", () => {
    const ical = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:Event One",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Event Two",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(extractVEvents(ical)).toHaveLength(2);
  });

  it("returns empty array when no VEVENTs exist", () => {
    const ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR";
    expect(extractVEvents(ical)).toEqual([]);
  });

  it("handles Unix line endings (LF only)", () => {
    const ical = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Test\nEND:VEVENT\nEND:VCALENDAR";
    expect(extractVEvents(ical)).toHaveLength(1);
  });

  it("ignores content outside VEVENT blocks", () => {
    const ical = [
      "BEGIN:VCALENDAR",
      "X-WR-CALNAME:My Calendar",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "SUMMARY:Yoga Class",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = extractVEvents(ical);
    expect(events).toHaveLength(1);
    expect(events[0]).not.toContain("VTIMEZONE");
    expect(events[0]).not.toContain("X-WR-CALNAME");
  });
});

// --------------- parseVEventField ---------------

describe("parseVEventField", () => {
  it("extracts a simple field value", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Morning Yoga\r\nEND:VEVENT";
    expect(parseVEventField(vevent, "SUMMARY")).toBe("Morning Yoga");
  });

  it("extracts UID", () => {
    const vevent = "BEGIN:VEVENT\r\nUID:abc-123@example.com\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    expect(parseVEventField(vevent, "UID")).toBe("abc-123@example.com");
  });

  it("returns undefined for missing field", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    expect(parseVEventField(vevent, "DESCRIPTION")).toBeUndefined();
  });

  it("handles field with parameters (semicolon)", () => {
    const vevent = "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20240615\r\nEND:VEVENT";
    expect(parseVEventField(vevent, "DTSTART")).toBe("20240615");
  });

  it("handles DTSTART with TZID parameter", () => {
    const vevent = "BEGIN:VEVENT\r\nDTSTART;TZID=America/New_York:20240615T090000\r\nEND:VEVENT";
    expect(parseVEventField(vevent, "DTSTART")).toBe("20240615T090000");
  });

  it("handles folded lines", () => {
    const vevent = [
      "BEGIN:VEVENT",
      "DESCRIPTION:This is a long ",
      " description that wraps",
      "END:VEVENT",
    ].join("\r\n");
    expect(parseVEventField(vevent, "DESCRIPTION")).toBe("This is a long description that wraps");
  });

  it("is case-insensitive on field name", () => {
    const vevent = "BEGIN:VEVENT\r\nsummary:Yoga Flow\r\nEND:VEVENT";
    expect(parseVEventField(vevent, "SUMMARY")).toBe("Yoga Flow");
  });
});

// --------------- queryUpcomingByLocation ---------------

function makeVevent(uid: string, dtstart: string, summary = "Yoga Class"): string {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtstart}`,
    `SUMMARY:${summary}`,
    "END:VEVENT",
  ].join("\r\n");
}

describe("queryUpcomingByLocation", () => {
  it("returns a map of uid#startTime to record", async () => {
    const rawVevent = makeVevent("uid-1", "20260420T110000Z");
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          uid: { S: "uid-1" },
          startTime: { S: "2026-04-20T11:00:00.000Z" },
          rawVevent: { S: rawVevent },
        },
      ],
      LastEvaluatedKey: undefined,
    });

    const map = await queryUpcomingByLocation(
      "Triangle Rock Club - Morrisville",
      "2026-04-11T00:00:00.000Z"
    );

    expect(map.size).toBe(1);
    expect(map.get("uid-1#2026-04-20T11:00:00.000Z")).toEqual({
      uid: "uid-1",
      startTime: "2026-04-20T11:00:00.000Z",
      rawVevent,
    });
  });

  it("paginates until LastEvaluatedKey is undefined", async () => {
    const vevent1 = makeVevent("uid-1", "20260420T110000Z");
    const vevent2 = makeVevent("uid-2", "20260421T110000Z");
    mockDynamoSend
      .mockResolvedValueOnce({
        Items: [{ uid: { S: "uid-1" }, startTime: { S: "2026-04-20T11:00:00.000Z" }, rawVevent: { S: vevent1 } }],
        LastEvaluatedKey: { uid: { S: "uid-1" } },
      })
      .mockResolvedValueOnce({
        Items: [{ uid: { S: "uid-2" }, startTime: { S: "2026-04-21T11:00:00.000Z" }, rawVevent: { S: vevent2 } }],
        LastEvaluatedKey: undefined,
      });

    const map = await queryUpcomingByLocation(
      "Triangle Rock Club - Morrisville",
      "2026-04-11T00:00:00.000Z"
    );

    expect(map.size).toBe(2);
    expect(mockDynamoSend).toHaveBeenCalledTimes(2);
  });
});

// --------------- handler ---------------

describe("handler", () => {
  it("skips unchanged events — no SQS send, no delete", async () => {
    const vevent = makeVevent("uid-1", "20260420T110000Z", "Yoga Class");
    const ical = `BEGIN:VCALENDAR\r\n${vevent}\r\nEND:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => ical });
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          uid: { S: "uid-1" },
          startTime: { S: "2026-04-20T11:00:00.000Z" },
          rawVevent: { S: vevent },
        },
      ],
      LastEvaluatedKey: undefined,
    });

    const res = await handler();

    expect(mockSqsSend).not.toHaveBeenCalled();
    expect(mockDynamoSend).toHaveBeenCalledTimes(1); // only the GSI query
    expect(res.body).toContain("Sent 0");
    expect(res.body).toContain("deleted 0");
  });

  it("sends changed events to SQS without contentHash field", async () => {
    const oldVevent = makeVevent("uid-1", "20260420T110000Z", "Old Class");
    const newVevent = makeVevent("uid-1", "20260420T110000Z", "New Class");
    const ical = `BEGIN:VCALENDAR\r\n${newVevent}\r\nEND:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => ical });
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          uid: { S: "uid-1" },
          startTime: { S: "2026-04-20T11:00:00.000Z" },
          rawVevent: { S: oldVevent },
        },
      ],
      LastEvaluatedKey: undefined,
    });
    mockSqsSend.mockResolvedValueOnce({});

    await handler();

    expect(mockSqsSend).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(mockSqsSend.mock.calls[0][0].input.Entries[0].MessageBody);
    expect(sent.title).toBe("New Class");
    expect(sent.contentHash).toBeUndefined();
  });

  it("sends new events (not in DynamoDB) to SQS", async () => {
    const vevent = makeVevent("uid-new", "20260420T110000Z");
    const ical = `BEGIN:VCALENDAR\r\n${vevent}\r\nEND:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => ical });
    mockDynamoSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    mockSqsSend.mockResolvedValueOnce({});

    const res = await handler();

    expect(mockSqsSend).toHaveBeenCalledTimes(1);
    expect(res.body).toContain("Sent 1");
  });

  it("deletes ghost events (in DynamoDB but not in feed)", async () => {
    const vevent = makeVevent("uid-real", "20260420T110000Z");
    const ghostVevent = makeVevent("uid-ghost", "20260421T110000Z");
    const ical = `BEGIN:VCALENDAR\r\n${vevent}\r\nEND:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => ical });
    mockDynamoSend
      .mockResolvedValueOnce({
        Items: [
          { uid: { S: "uid-real" }, startTime: { S: "2026-04-20T11:00:00.000Z" }, rawVevent: { S: vevent } },
          { uid: { S: "uid-ghost" }, startTime: { S: "2026-04-21T11:00:00.000Z" }, rawVevent: { S: ghostVevent } },
        ],
        LastEvaluatedKey: undefined,
      })
      .mockResolvedValueOnce({}); // DeleteItemCommand response

    const res = await handler();

    expect(mockDynamoSend).toHaveBeenCalledTimes(2);
    const deleteCall = mockDynamoSend.mock.calls[1][0].input;
    expect(deleteCall.Key.uid.S).toBe("uid-ghost");
    expect(deleteCall.Key.startTime.S).toBe("2026-04-21T11:00:00.000Z");
    expect(res.body).toContain("deleted 1");
  });

  it("skips location entirely when feed fetch fails — no query, no deletes", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const res = await handler();

    expect(mockDynamoSend).not.toHaveBeenCalled();
    expect(mockSqsSend).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("treats records with missing rawVevent as new and sends to SQS", async () => {
    const vevent = makeVevent("uid-1", "20260420T110000Z");
    const ical = `BEGIN:VCALENDAR\r\n${vevent}\r\nEND:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => ical });
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          uid: { S: "uid-1" },
          startTime: { S: "2026-04-20T11:00:00.000Z" },
          rawVevent: { S: "" },
        },
      ],
      LastEvaluatedKey: undefined,
    });
    mockSqsSend.mockResolvedValueOnce({});

    const res = await handler();

    expect(mockSqsSend).toHaveBeenCalledTimes(1);
    expect(res.body).toContain("Sent 1");
  });
});
