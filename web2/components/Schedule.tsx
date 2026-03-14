"use client";

import { useState, useEffect } from "react";
import type { ClassEvent } from "@/app/page";

// Muted earthy palette per location
const LOCATION_COLORS: Record<string, { accent: string; light: string; dot: string }> = {
  Morrisville:     { accent: "#6B5FBF", light: "#EEEAF8", dot: "#5248A3" },
  "North Raleigh": { accent: "#4A9B7F", light: "#E6F4EF", dot: "#357A62" },
  "Salvage Yard":  { accent: "#B83A3A", light: "#F5E8E8", dot: "#952E2E" },
  Durham:          { accent: "#C98A2E", light: "#FAF0DC", dot: "#A86E1A" },
};

const LOCATIONS = ["Morrisville", "North Raleigh", "Salvage Yard", "Durham"];

const LOCATION_ABBREVS: Record<string, string> = {
  "Morrisville":   "MV",
  "North Raleigh": "NR",
  "Salvage Yard":  "SY",
  "Durham":        "D",
};

function buildIcalUrl(selectedLocations: Set<string>, viewType: string): string {
  const type = viewType.toLowerCase();
  const abbrevs =
    selectedLocations.size === 0
      ? ["D", "MV", "NR", "SY"]
      : [...selectedLocations].map((l) => LOCATION_ABBREVS[l]).filter(Boolean).sort();
  return `https://trc.yoga/calendars/${type}/${abbrevs.join("_")}.ics`;
}

function formatSyncedLabel(timestamp: string): string {
  const sync = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const timeStr = sync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sync.toDateString() === now.toDateString()) return `Synced ${timeStr}`;
  if (sync.toDateString() === yesterday.toDateString()) return `Synced yesterday at ${timeStr}`;
  return `Synced ${sync.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${timeStr}`;
}

function formatDateHeader(dateStr: string, today: Date): { label: string; sub: string; past: boolean } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  const full = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const short = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  if (diff === -1) return { label: "Yesterday", sub: short, past: true };
  if (diff === 0)  return { label: "Today",     sub: short, past: false };
  if (diff === 1)  return { label: "Tomorrow",  sub: short, past: false };
  return { label: full.split(",")[0], sub: short, past: false };
}

function ExpandingSection({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateRows: open ? "1fr" : "0fr",
      transition: "grid-template-rows 0.35s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

interface ClassCardProps {
  cls: ClassEvent;
  isOpen: boolean;
  isPast: boolean;
  onToggle: (id: string) => void;
}

function ClassCard({ cls, isOpen, isPast, onToggle }: ClassCardProps) {
  const color = LOCATION_COLORS[cls.location] ?? { accent: "#888", light: "#eee", dot: "#555" };
  const isFull = cls.soldOut;

  return (
    <div style={{
      background: isOpen ? "#FDFAF7" : "white",
      borderRadius: 12,
      border: isOpen ? `1px solid ${color.accent}44` : "1px solid #EDE8E3",
      boxShadow: isOpen ? `0 4px 20px rgba(0,0,0,0.06)` : "0 1px 3px rgba(0,0,0,0.04)",
      opacity: isPast ? 0.45 : 1,
      transition: "box-shadow 0.25s, border-color 0.25s, background 0.25s",
      overflow: "hidden",
    }}>
      {/* Collapsed row */}
      <div
        onClick={() => !isPast && onToggle(cls.id)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px",
          cursor: isPast ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        {/* Color strip */}
        <div style={{
          width: 3, alignSelf: "stretch", borderRadius: 4, flexShrink: 0,
          background: color.accent,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: 15,
            color: isPast ? "#9CA3AF" : "#2C2420",
            marginBottom: 4,
            letterSpacing: "-0.1px",
          }}>
            {cls.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#9C8E86", flexWrap: "wrap" }}>
            <span>{cls.time} – {cls.end}</span>
            <span style={{ color: "#D6CEC9" }}>·</span>
            <span>{cls.instructor}</span>
            <span style={{ color: "#D6CEC9" }}>·</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.accent, display: "inline-block" }} />
              {cls.location}
            </span>
          </div>
        </div>

        {/* Status + chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {isPast && <span style={{ fontSize: 11, color: "#C4B8B2", fontWeight: 500 }}>Past</span>}
          {!isPast && isFull && (
            <span style={{ fontSize: 11, color: "#B87A6A", fontWeight: 600, background: "#F9EDE9", padding: "3px 8px", borderRadius: 6 }}>Full</span>
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={isOpen ? color.accent : "#C4B8B2"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), stroke 0.2s",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded */}
      <ExpandingSection open={isOpen}>
        <div style={{ padding: "0 16px 18px 33px" }}>
          <div style={{ height: 1, background: "#EDE8E3", marginBottom: 16 }} />
          <p style={{
            fontSize: 13, lineHeight: 1.75,
            color: "#6B5F59",
            margin: "0 0 18px", padding: 0,
            fontStyle: "normal",
          }}>
            {cls.description}
          </p>
          {!isPast && cls.url && (
            <a
              href={cls.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "11px 20px",
                borderRadius: 8,
                fontWeight: 600, fontSize: 13,
                letterSpacing: "0.01em",
                background: color.accent,
                color: "white",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.82"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Reserve a spot
            </a>
          )}
        </div>
      </ExpandingSection>
    </div>
  );
}

export function Schedule({ events, dataTimestamp }: { events: ClassEvent[]; dataTimestamp: string }) {
  const [selectedLocations, setSelectedLocations] = useState(new Set<string>());
  const [viewType, setViewType] = useState("Yoga");
  const [openId, setOpenId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync isMobile after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const toggleOpen = (id: string) => setOpenId((prev) => (prev === id ? null : id));
  const toggleLocation = (loc: string) => setSelectedLocations((prev) => {
    const next = new Set(prev);
    next.has(loc) ? next.delete(loc) : next.add(loc);
    return next;
  });

  const copyIcal = () => {
    const url = buildIcalUrl(selectedLocations, viewType);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString("en-CA"); // "YYYY-MM-DD"

  const filtered = events.filter((c) => {
    if (c.category !== viewType.toLowerCase()) return false;
    if (c.date < todayStr) return false;
    return selectedLocations.size === 0 || selectedLocations.has(c.location);
  });

  const groupedByDate = filtered.reduce<Record<string, { date: string; byTime: Record<string, ClassEvent[]> }>>(
    (acc, cls) => {
      if (!acc[cls.date]) acc[cls.date] = { date: cls.date, byTime: {} };
      if (!acc[cls.date].byTime[cls.time]) acc[cls.date].byTime[cls.time] = [];
      acc[cls.date].byTime[cls.time].push(cls);
      return acc;
    },
    {}
  );

  const dateGroups = Object.values(groupedByDate).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif", background: "#FAF7F4", minHeight: "100vh" }}>

      {/* Nav */}
      <div style={{
        background: "#FAF7F4",
        borderBottom: "1px solid #EDE8E3",
      }}>
        <div style={{
          maxWidth: isMobile ? "100%" : 960,
          margin: "0 auto",
          padding: isMobile ? "20px 20px 0" : "28px 48px 0",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg width="32" height="32" viewBox="0 0 100 95" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              {/* Far left dark face */}
              <polygon points="44,4 4,78 28,72" fill="#1E2329" />
              {/* Left main face */}
              <polygon points="44,4 28,72 50,78" fill="#3D4450" />
              {/* Centre highlight facet */}
              <polygon points="44,4 58,32 52,62 38,54" fill="#5C6472" />
              {/* Right main face */}
              <polygon points="44,4 80,68 96,76 58,32" fill="#474E5C" />
              {/* Far right shoulder */}
              <polygon points="58,32 96,76 100,70 72,30" fill="#363C48" />
              {/* Dark shadow crease left */}
              <polygon points="44,4 36,40 28,72 35,68" fill="#252A32" />
              {/* Green ground — rolling hills */}
              <ellipse cx="30" cy="84" rx="32" ry="10" fill="#5A8C3C" />
              <ellipse cx="72" cy="86" rx="30" ry="9" fill="#4E7A34" />
              <ellipse cx="50" cy="88" rx="50" ry="9" fill="#5A8C3C" />
            </svg>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#2C2420", letterSpacing: "-0.3px" }}>TRC Yoga</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-end" : "center", gap: isMobile ? 4 : 10 }}>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 400, fontSize: 11, color: "#B0A49E" }}>
              {formatSyncedLabel(dataTimestamp)}
            </div>
            <button onClick={copyIcal} title="Copy iCal link" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", borderRadius: 8, cursor: "pointer",
              fontWeight: 500, fontSize: 12,
              border: copied ? "1.5px solid #4A9B7F" : "1.5px solid #C4B8B2",
              background: copied ? "#E6F4EF" : "white",
              color: copied ? "#357A62" : "#6B5E57",
              transition: "all 0.2s",
            }}>
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
              {copied ? "Copied!" : "iCal"}
            </button>
          </div>
        </div>

        {/* Tabs + filters row */}
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex" }}>
            {["Yoga", "Fitness"].map((t) => (
              <button key={t} onClick={() => setViewType(t)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: viewType === t ? "#2C2420" : "#B0A49E",
                fontWeight: viewType === t ? 600 : 400,
                fontSize: 14,
                padding: "14px 16px 14px 0",
                marginRight: 8,
                borderBottom: viewType === t ? "2px solid #C1694F" : "2px solid transparent",
                transition: "all 0.2s",
              }}>{t}</button>
            ))}
          </div>

          {/* Location filters */}
          <div style={{
            display: "flex", gap: 6, alignItems: "center",
            overflowX: "auto", scrollbarWidth: "none",
            padding: isMobile ? "10px 0 14px" : "0",
            width: isMobile ? "100%" : "auto",
          }}>
            {LOCATIONS.map((loc) => {
              const color = LOCATION_COLORS[loc];
              const isActive = selectedLocations.has(loc);
              return (
                <button key={loc} onClick={() => toggleLocation(loc)} style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                  fontWeight: 500, fontSize: 12,
                  border: isActive ? `1.5px solid ${color.accent}` : "1.5px solid #E5DDD8",
                  background: isActive ? color.light : "transparent",
                  color: isActive ? color.dot : "#B0A49E",
                  transition: "all 0.15s",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.accent, display: "inline-block", flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                  {loc}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* Body */}
      <div style={{
        maxWidth: isMobile ? "100%" : 960,
        margin: "0 auto",
        padding: isMobile ? "24px 16px 80px" : "36px 48px 80px",
      }}>

        {/* Schedule */}
        {dateGroups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#B0A49E" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🪷</div>
            <div style={{ fontSize: 17, marginBottom: 6, color: "#7A6E69" }}>No classes found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your studio filters</div>
          </div>
        ) : (
          dateGroups.map(({ date, byTime }) => {
            const { label, sub, past } = formatDateHeader(date, today);
            const [year, month, day] = date.split("-").map(Number);
            const d = new Date(year, month - 1, day);
            const isPast = d < today;

            return (
              <div key={date} style={{ marginBottom: 40 }}>
                {/* Date header */}
                <div style={{
                  display: "flex", alignItems: "baseline", gap: 10,
                  marginBottom: 16, paddingBottom: 12,
                  borderBottom: "1px solid #EDE8E3",
                }}>
                  <span style={{
                    fontSize: 18, fontWeight: 700,
                    color: isPast ? "#C4B8B2" : "#2C2420",
                    letterSpacing: "-0.2px",
                  }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#B0A49E", fontWeight: 400 }}>{sub}</span>
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.values(byTime).flat().map((cls) => (
                    <ClassCard
                      key={cls.id} cls={cls}
                      isOpen={openId === cls.id}
                      isPast={isPast || past}
                      onToggle={toggleOpen}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
