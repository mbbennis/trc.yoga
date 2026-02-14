import { extractVEvents, isYogaEvent, parseVEventField } from "./ingest";

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

// --------------- isYogaEvent ---------------

describe("isYogaEvent", () => {
  it("matches yoga in SUMMARY", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Morning Yoga Flow\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(true);
  });

  it("matches yoga in DESCRIPTION", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Fitness Class\r\nDESCRIPTION:A relaxing yoga session\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(true);
  });

  it("matches yoga in LOCATION", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Class\r\nLOCATION:Downtown Yoga Studio\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(true);
  });

  it("is case-insensitive", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:POWER YOGA\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(true);
  });

  it("returns false when yoga is not present", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Pilates Class\r\nDESCRIPTION:Core workout\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(false);
  });

  it("handles SUMMARY with parameters (e.g. SUMMARY;LANGUAGE=en:)", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY;LANGUAGE=en:Yoga Class\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(true);
  });

  it("handles folded (continuation) lines", () => {
    const vevent = [
      "BEGIN:VEVENT",
      "SUMMARY:Long Event Name That Gets",
      " Folded And Contains Yoga Here",
      "END:VEVENT",
    ].join("\r\n");
    expect(isYogaEvent(vevent)).toBe(true);
  });

  it("does not match yoga in unrelated fields like DTSTART", () => {
    // "yoga" appearing in an unrelated field should not match
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Pilates\r\nX-CUSTOM:yoga\r\nEND:VEVENT";
    expect(isYogaEvent(vevent)).toBe(false);
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
