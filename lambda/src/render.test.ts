import { formatTime, formatDayLabel, formatDateShort, dateKey, groupByDay } from "./render";

// ---------- formatTime ----------

describe("formatTime", () => {
  it("formats a morning time", () => {
    // 2026-03-07T14:30:00.000Z = 9:30 AM ET
    const result = formatTime("2026-03-07T14:30:00.000Z");
    expect(result).toBe("9:30 AM");
  });

  it("formats an afternoon time", () => {
    // 2026-03-07T22:00:00.000Z = 5:00 PM ET
    const result = formatTime("2026-03-07T22:00:00.000Z");
    expect(result).toBe("5:00 PM");
  });

  it("formats noon", () => {
    // 2026-03-07T17:00:00.000Z = 12:00 PM ET
    const result = formatTime("2026-03-07T17:00:00.000Z");
    expect(result).toBe("12:00 PM");
  });

  it("formats early morning", () => {
    // 2026-03-07T11:00:00.000Z = 6:00 AM ET
    const result = formatTime("2026-03-07T11:00:00.000Z");
    expect(result).toBe("6:00 AM");
  });
});

// ---------- formatDayLabel ----------

describe("formatDayLabel", () => {
  // Use a fixed "now" in ET: March 7, 2026 at 10:00 AM ET = 15:00 UTC
  const now = new Date("2026-03-07T15:00:00.000Z");

  it("returns 'Today' for same-day event", () => {
    const result = formatDayLabel("2026-03-07T20:00:00.000Z", now);
    expect(result).toBe("Today");
  });

  it("returns 'Tomorrow' for next-day event", () => {
    const result = formatDayLabel("2026-03-08T14:00:00.000Z", now);
    expect(result).toBe("Tomorrow");
  });

  it("returns the weekday for a day 2–7 days out", () => {
    const result = formatDayLabel("2026-03-10T14:00:00.000Z", now); // 3 days out
    expect(result).toBe("Tuesday");
  });

  it("returns 'Next Weekday' for a day 8–14 days out", () => {
    const result = formatDayLabel("2026-03-17T14:00:00.000Z", now); // 10 days out
    expect(result).toBe("Next Tuesday");
  });

  it("handles late-night UTC that is still same day in ET", () => {
    // March 8 04:00 UTC = March 7 11:00 PM ET → still "Today"
    const result = formatDayLabel("2026-03-08T04:00:00.000Z", now);
    expect(result).toBe("Today");
  });
});

// ---------- formatDateShort ----------

describe("formatDateShort", () => {
  it("formats as 'Month Day'", () => {
    const result = formatDateShort("2026-03-07T14:30:00.000Z");
    expect(result).toBe("March 7");
  });

  it("handles timezone offset", () => {
    // March 8 03:00 UTC = March 7 10:00 PM ET
    const result = formatDateShort("2026-03-08T03:00:00.000Z");
    expect(result).toBe("March 7");
  });
});

// ---------- dateKey ----------

describe("dateKey", () => {
  it("returns YYYY-MM-DD in ET", () => {
    const result = dateKey("2026-03-07T14:30:00.000Z");
    expect(result).toBe("2026-03-07");
  });

  it("handles timezone offset (late UTC = previous day ET)", () => {
    // March 8 03:00 UTC = March 7 10:00 PM ET
    const result = dateKey("2026-03-08T03:00:00.000Z");
    expect(result).toBe("2026-03-07");
  });
});

// ---------- groupByDay ----------

describe("groupByDay", () => {
  const now = new Date("2026-03-07T15:00:00.000Z");

  const makeEvent = (uid: string, startTime: string) => ({
    uid,
    title: `Event ${uid}`,
    timeRange: "9:00 AM – 10:00 AM",
    locationAbbr: "MV",
    locationName: "Morrisville",
    color: "#3b82f6",
    description: "",
    url: "",
    soldOut: false,
    hasDetails: false,
    startTime,
    category: "yoga",
    instructor: "",
  });

  it("groups events by date", () => {
    const events = [
      makeEvent("1", "2026-03-07T14:00:00.000Z"),
      makeEvent("2", "2026-03-07T16:00:00.000Z"),
      makeEvent("3", "2026-03-08T14:00:00.000Z"),
    ];

    const days = groupByDay(events, now);
    expect(days).toHaveLength(2);
    expect(days[0].label).toBe("Today");
    expect(days[0].dateShort).toBe("March 7");
    expect(days[0].events).toHaveLength(2);
    expect(days[1].label).toBe("Tomorrow");
    expect(days[1].dateShort).toBe("March 8");
    expect(days[1].events).toHaveLength(1);
  });

  it("returns empty array for no events", () => {
    const days = groupByDay([], now);
    expect(days).toHaveLength(0);
  });

  it("creates one group per unique date", () => {
    const events = [
      makeEvent("1", "2026-03-09T14:00:00.000Z"),
      makeEvent("2", "2026-03-10T14:00:00.000Z"),
      makeEvent("3", "2026-03-11T14:00:00.000Z"),
    ];

    const days = groupByDay(events, now);
    expect(days).toHaveLength(3);
  });
});
