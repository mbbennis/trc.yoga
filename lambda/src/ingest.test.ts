import { extractVEvents, parseVEventField, computeContentHash } from "./ingest";

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
