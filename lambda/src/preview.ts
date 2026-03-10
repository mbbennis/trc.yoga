/**
 * Quick preview script — renders the template with mock data and writes to v2-tmp/index.html.
 * Usage: npx tsx src/preview.ts
 */
import { writeFileSync } from "fs";
import { Eta } from "eta";
import { PAGE_TEMPLATE } from "./render-templates";
import { formatTime, formatDateShort, formatDayLabel, groupByDay, formatSyncedAt } from "./render";

const eta = new Eta();

const LOCATIONS = [
  { abbr: "MV", name: "Morrisville", color: "#6B5FBF", colorLight: "#EEEAF8" },
  { abbr: "NR", name: "North Raleigh", color: "#4A9B7F", colorLight: "#E6F4EF" },
  { abbr: "SY", name: "Salvage Yard", color: "#B83A3A", colorLight: "#FAEEE9" },
  { abbr: "D", name: "Durham", color: "#C98A2E", colorLight: "#FAF0DC" },
];

const now = new Date();

function makeEvent(
  uid: string,
  title: string,
  startISO: string,
  endISO: string,
  locAbbr: string,
  opts: { instructor?: string; description?: string; soldOut?: boolean; category?: string; url?: string } = {}
) {
  const loc = LOCATIONS.find((l) => l.abbr === locAbbr)!;
  const description = opts.description ?? "";
  const url = opts.url ?? "";
  return {
    uid,
    title,
    timeRange: `${formatTime(startISO)} \u2013 ${formatTime(endISO)}`,
    locationAbbr: locAbbr,
    locationName: loc.name,
    color: loc.color,
    description,
    url,
    soldOut: opts.soldOut ?? false,
    hasDetails: !!(description || url),
    startTime: startISO,
    category: opts.category ?? "yoga",
    instructor: opts.instructor ?? "",
  };
}

// Build dates relative to now
function dayOffset(days: number, hour: number, min: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function endTime(startISO: string, minutes: number): string {
  return new Date(new Date(startISO).getTime() + minutes * 60000).toISOString();
}

const events = [
  // Today
  makeEvent("1", "Hatha Flow", dayOffset(0, 7, 0), endTime(dayOffset(0, 7, 0), 50), "MV", {
    instructor: "Sara K.",
    description: "A grounding practice linking breath to movement through traditional postures. Expect long holds, deliberate transitions, and space to settle into stillness.",
    url: "https://rockgympro.com/offering/1",
  }),
  makeEvent("2", "Yin", dayOffset(0, 9, 0), endTime(dayOffset(0, 9, 0), 60), "D", {
    instructor: "Mia T.",
    description: "Slow, floor-based practice with long passive holds designed to release deep connective tissue. Deeply restorative.",
    url: "https://rockgympro.com/offering/2",
  }),
  makeEvent("3", "Pranayama & Meditation", dayOffset(0, 10, 15), endTime(dayOffset(0, 10, 15), 45), "NR", {
    instructor: "Leila R.",
    description: "A seated practice exploring breathwork techniques followed by guided meditation.",
    url: "https://rockgympro.com/offering/3",
    soldOut: true,
  }),

  // Tomorrow
  makeEvent("4", "Vinyasa", dayOffset(1, 6, 30), endTime(dayOffset(1, 6, 30), 50), "MV", {
    instructor: "Sara K.",
    description: "A dynamic, breath-led sequence that builds heat and fluidity.",
    url: "https://rockgympro.com/offering/4",
  }),
  makeEvent("5", "Hatha Flow", dayOffset(1, 6, 30), endTime(dayOffset(1, 6, 30), 50), "NR", {
    instructor: "James O.",
    url: "https://rockgympro.com/offering/5",
  }),
  makeEvent("6", "Yin", dayOffset(1, 8, 0), endTime(dayOffset(1, 8, 0), 60), "SY", {
    instructor: "Mia T.",
    description: "Slow, floor-based practice with long passive holds.",
    url: "https://rockgympro.com/offering/6",
  }),
  makeEvent("7", "Sculpt", dayOffset(1, 9, 30), endTime(dayOffset(1, 9, 30), 45), "MV", {
    instructor: "Sara K.",
    description: "Yoga meets strength training. Expect flowing sequences layered with light weights and bodyweight conditioning.",
    url: "https://rockgympro.com/offering/7",
    category: "fitness",
  }),
  makeEvent("8", "Run Club", dayOffset(1, 17, 30), endTime(dayOffset(1, 17, 30), 60), "NR", {
    instructor: "James O.",
    description: "Weekly group run from the gym. All paces welcome.",
    url: "https://rockgympro.com/offering/8",
    category: "fitness",
  }),
  makeEvent("9", "Restorative", dayOffset(1, 19, 0), endTime(dayOffset(1, 19, 0), 60), "D", {
    instructor: "Mia T.",
    description: "Fully supported postures held for several minutes using bolsters, blankets, and blocks.",
    url: "https://rockgympro.com/offering/9",
    soldOut: true,
  }),

  // Day after tomorrow
  makeEvent("10", "Vinyasa", dayOffset(2, 7, 0), endTime(dayOffset(2, 7, 0), 50), "SY", {
    instructor: "James O.",
    url: "https://rockgympro.com/offering/10",
  }),
  makeEvent("11", "Hatha Flow", dayOffset(2, 7, 0), endTime(dayOffset(2, 7, 0), 50), "D", {
    instructor: "Sara K.",
    description: "A grounding practice linking breath to movement.",
    url: "https://rockgympro.com/offering/11",
  }),
  makeEvent("12", "Sculpt", dayOffset(2, 10, 0), endTime(dayOffset(2, 10, 0), 45), "NR", {
    instructor: "Sara K.",
    url: "https://rockgympro.com/offering/12",
    category: "fitness",
  }),
  makeEvent("13", "Restorative", dayOffset(2, 17, 0), endTime(dayOffset(2, 17, 0), 60), "SY", {
    instructor: "James O.",
    description: "Fully supported postures held for several minutes.",
    url: "https://rockgympro.com/offering/13",
  }),

  // 3 days out
  makeEvent("14", "Vinyasa", dayOffset(3, 6, 30), endTime(dayOffset(3, 6, 30), 50), "MV", {
    instructor: "Sara K.",
    url: "https://rockgympro.com/offering/14",
  }),
  makeEvent("15", "Yin", dayOffset(3, 8, 0), endTime(dayOffset(3, 8, 0), 60), "NR", {
    instructor: "Leila R.",
    description: "Slow, floor-based practice with long passive holds designed to release deep connective tissue.",
    url: "https://rockgympro.com/offering/15",
  }),
];

events.sort((a, b) => a.startTime.localeCompare(b.startTime));

const days = groupByDay(events, now);

const categories = [
  { id: "yoga", name: "Yoga", color: "#6B5FBF" },
  { id: "fitness", name: "Fitness", color: "#C1694F" },
];

const html = eta.renderString(PAGE_TEMPLATE, {
  title: "TRC Yoga",
  categories,
  locations: LOCATIONS,
  days,
  syncedAt: formatSyncedAt(now.toISOString(), now),
});

const outPath = new URL("../../v2-tmp/index.html", import.meta.url).pathname;
writeFileSync(outPath, html, "utf-8");
console.log(`Wrote ${outPath} (${events.length} events, ${days.length} days)`);
