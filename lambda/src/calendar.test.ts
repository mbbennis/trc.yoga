import { powerSet, buildIcalFile, replaceDescription, replaceLocation, replaceVeventField } from "./calendar";
import { extractOfferingUrl } from "./capacity";

// --------------- powerSet ---------------

describe("powerSet", () => {
  it("returns all non-empty subsets of 4 items (15 total)", () => {
    const result = powerSet(["D", "MV", "NR", "SY"]);
    expect(result).toHaveLength(15);
  });

  it("returns subsets sorted alphabetically", () => {
    const result = powerSet(["SY", "D", "MV", "NR"]);
    // Each subset should be sorted
    for (const subset of result) {
      const sorted = [...subset].sort();
      expect(subset).toEqual(sorted);
    }
  });

  it("includes all singletons", () => {
    const result = powerSet(["D", "MV", "NR", "SY"]);
    expect(result).toContainEqual(["D"]);
    expect(result).toContainEqual(["MV"]);
    expect(result).toContainEqual(["NR"]);
    expect(result).toContainEqual(["SY"]);
  });

  it("includes the full set", () => {
    const result = powerSet(["D", "MV", "NR", "SY"]);
    expect(result).toContainEqual(["D", "MV", "NR", "SY"]);
  });

  it("includes specific pairs and triples", () => {
    const result = powerSet(["D", "MV", "NR", "SY"]);
    expect(result).toContainEqual(["D", "MV"]);
    expect(result).toContainEqual(["MV", "NR", "SY"]);
  });

  it("returns 1 subset for a single item", () => {
    expect(powerSet(["A"])).toEqual([["A"]]);
  });

  it("returns 3 subsets for 2 items", () => {
    const result = powerSet(["B", "A"]);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual(["A"]);
    expect(result).toContainEqual(["B"]);
    expect(result).toContainEqual(["A", "B"]);
  });

  it("returns empty array for empty input", () => {
    expect(powerSet([])).toEqual([]);
  });
});

// --------------- buildIcalFile ---------------

describe("buildIcalFile", () => {
  it("wraps vevents in a VCALENDAR envelope", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = buildIcalFile([vevent], "Test Calendar");

    expect(result).toContain("BEGIN:VCALENDAR");
    expect(result).toContain("END:VCALENDAR");
    expect(result).toContain("VERSION:2.0");
    expect(result).toContain("PRODID:-//yoga-calendar//EN");
  });

  it("sets X-WR-CALNAME", () => {
    const result = buildIcalFile([], "Durham, Morrisville");
    expect(result).toContain("X-WR-CALNAME:Durham, Morrisville");
  });

  it("includes all provided vevents", () => {
    const v1 = "BEGIN:VEVENT\r\nSUMMARY:Event 1\r\nEND:VEVENT";
    const v2 = "BEGIN:VEVENT\r\nSUMMARY:Event 2\r\nEND:VEVENT";
    const result = buildIcalFile([v1, v2], "Cal");
    expect(result).toContain("SUMMARY:Event 1");
    expect(result).toContain("SUMMARY:Event 2");
  });

  it("produces valid output with no events", () => {
    const result = buildIcalFile([], "Empty");
    expect(result).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(result).toMatch(/END:VCALENDAR\r\n$/);
  });

  it("uses CRLF line endings", () => {
    const result = buildIcalFile([], "Test");
    const lines = result.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[1]).toBe("VERSION:2.0");
  });
});

// --------------- replaceDescription ---------------

describe("replaceDescription", () => {
  it("replaces an existing DESCRIPTION field", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nDESCRIPTION:Old text\r\nEND:VEVENT";
    const result = replaceDescription(raw, "New improved text");
    expect(result).toContain("DESCRIPTION:New improved text");
    expect(result).not.toContain("Old text");
  });

  it("handles multi-line (folded) DESCRIPTION", () => {
    const raw = [
      "BEGIN:VEVENT",
      "SUMMARY:Yoga",
      "DESCRIPTION:First line",
      " continuation line",
      " another continuation",
      "DTSTART:20260615T090000",
      "END:VEVENT",
    ].join("\r\n");

    const result = replaceDescription(raw, "Short improved");
    expect(result).toContain("DESCRIPTION:Short improved");
    expect(result).not.toContain("First line");
    expect(result).not.toContain("continuation line");
    expect(result).toContain("DTSTART:20260615T090000");
  });

  it("inserts DESCRIPTION if none exists", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = replaceDescription(raw, "Added description");
    expect(result).toContain("DESCRIPTION:Added description");
    expect(result).toContain("BEGIN:VEVENT");
    expect(result).toContain("END:VEVENT");
  });

  it("escapes special iCal characters", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = replaceDescription(raw, "Line1\nLine2; with semicolons, and commas");
    expect(result).toContain("DESCRIPTION:Line1\\nLine2\\; with semicolons\\, and commas");
  });

  it("preserves other fields", () => {
    const raw = [
      "BEGIN:VEVENT",
      "UID:abc@example.com",
      "SUMMARY:Morning Flow",
      "DESCRIPTION:Old",
      "DTSTART:20260615T090000",
      "DTEND:20260615T100000",
      "END:VEVENT",
    ].join("\r\n");

    const result = replaceDescription(raw, "Improved");
    expect(result).toContain("UID:abc@example.com");
    expect(result).toContain("SUMMARY:Morning Flow");
    expect(result).toContain("DTSTART:20260615T090000");
    expect(result).toContain("DTEND:20260615T100000");
    expect(result).toContain("DESCRIPTION:Improved");
  });

  it("handles DESCRIPTION with parameters", () => {
    const raw = "BEGIN:VEVENT\r\nDESCRIPTION;LANGUAGE=en:Old text\r\nEND:VEVENT";
    const result = replaceDescription(raw, "New text");
    expect(result).toContain("DESCRIPTION:New text");
    expect(result).not.toContain("Old text");
  });
});

// --------------- replaceLocation ---------------

describe("replaceLocation", () => {
  it("replaces an existing LOCATION field", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nLOCATION:Old Place\r\nEND:VEVENT";
    const result = replaceLocation(raw, "123 Main St, Raleigh, NC 27601");
    expect(result).toContain("LOCATION:123 Main St\\, Raleigh\\, NC 27601");
    expect(result).not.toContain("Old Place");
  });

  it("inserts LOCATION if none exists", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = replaceLocation(raw, "123 Main St");
    expect(result).toContain("LOCATION:123 Main St");
    expect(result).toContain("END:VEVENT");
  });

  it("escapes special iCal characters", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = replaceLocation(raw, "Suite 400; Building A, Durham");
    expect(result).toContain("LOCATION:Suite 400\\; Building A\\, Durham");
  });

  it("preserves other fields", () => {
    const raw = [
      "BEGIN:VEVENT",
      "UID:abc@example.com",
      "SUMMARY:Morning Flow",
      "LOCATION:Old",
      "DTSTART:20260615T090000",
      "END:VEVENT",
    ].join("\r\n");

    const result = replaceLocation(raw, "New Address");
    expect(result).toContain("UID:abc@example.com");
    expect(result).toContain("SUMMARY:Morning Flow");
    expect(result).toContain("DTSTART:20260615T090000");
    expect(result).toContain("LOCATION:New Address");
  });
});

// --------------- X-SOLD-OUT ---------------

describe("X-SOLD-OUT in VEVENT", () => {
  it("adds X-SOLD-OUT:TRUE when soldOut is true", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = replaceVeventField(raw, "X-SOLD-OUT", "TRUE");
    expect(result).toContain("X-SOLD-OUT:TRUE");
  });

  it("adds X-SOLD-OUT:FALSE when soldOut is false", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const result = replaceVeventField(raw, "X-SOLD-OUT", "FALSE");
    expect(result).toContain("X-SOLD-OUT:FALSE");
  });

  it("does not add X-SOLD-OUT when soldOut is undefined", () => {
    // Simulates the handler logic: replaceVeventField is only called when soldOut is defined
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const soldOut: boolean | undefined = undefined;
    let vevent = raw;
    if (soldOut !== undefined) {
      vevent = replaceVeventField(vevent, "X-SOLD-OUT", soldOut ? "TRUE" : "FALSE");
    }
    expect(vevent).not.toContain("X-SOLD-OUT");
  });

  it("replaces existing X-SOLD-OUT value", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nX-SOLD-OUT:FALSE\r\nEND:VEVENT";
    const result = replaceVeventField(raw, "X-SOLD-OUT", "TRUE");
    expect(result).toContain("X-SOLD-OUT:TRUE");
    expect(result).not.toContain("X-SOLD-OUT:FALSE");
  });
});

// --------------- X-LAST-MODIFIED ---------------

describe("X-LAST-MODIFIED in VEVENT", () => {
  it("adds X-LAST-MODIFIED with the ISO timestamp value", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const timestamp = "2026-02-14T12:30:00.000Z";
    const result = replaceVeventField(raw, "X-LAST-MODIFIED", timestamp);
    expect(result).toContain("X-LAST-MODIFIED:2026-02-14T12:30:00.000Z");
  });

  it("is omitted when lastModified is undefined", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const lastModified: string | undefined = undefined;
    let vevent = raw;
    if (lastModified) {
      vevent = replaceVeventField(vevent, "X-LAST-MODIFIED", lastModified);
    }
    expect(vevent).not.toContain("X-LAST-MODIFIED");
  });
});

// --------------- URL replaced with RGP offering URL ---------------

describe("URL replacement with RGP offering URL", () => {
  it("replaces URL with extracted offering URL", () => {
    const offeringUrl =
      "https://app.rockgympro.com/b/widget/?a=offering&offering_guid=abc123&widget_guid=def456&mode=e";
    const raw = [
      "BEGIN:VEVENT",
      "SUMMARY:Yoga",
      `URL:${offeringUrl}`,
      "END:VEVENT",
    ].join("\r\n");

    const extracted = extractOfferingUrl(raw);
    expect(extracted).toBeDefined();
    // mode=e should be swapped to mode=p
    expect(extracted).toContain("mode=p");

    const result = replaceVeventField(raw, "URL", extracted!);
    expect(result).toContain("mode=p");
    expect(result).not.toContain("mode=e");
  });

  it("falls back to event.url when no offering URL is available", () => {
    const raw = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    const extracted = extractOfferingUrl(raw);
    expect(extracted).toBeUndefined();

    // Simulate fallback logic
    const fallbackUrl = "https://trianglerockclub.com/fitness-yoga/";
    const result = replaceVeventField(raw, "URL", fallbackUrl);
    expect(result).toContain(`URL:${fallbackUrl}`);
  });
});
