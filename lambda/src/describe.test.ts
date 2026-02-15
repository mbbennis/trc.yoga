import { buildPrompt, classifyEvent } from "./describe";

// --------------- classifyEvent ---------------

describe("classifyEvent", () => {
  it("returns yoga when SUMMARY contains yoga", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Morning Yoga Flow\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("yoga");
  });

  it("returns yoga when DESCRIPTION contains yoga", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Fitness Class\r\nDESCRIPTION:A relaxing yoga session\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("yoga");
  });

  it("returns yoga when LOCATION contains yoga", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Class\r\nLOCATION:Downtown Yoga Studio\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("yoga");
  });

  it("is case-insensitive", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:POWER YOGA\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("yoga");
  });

  it("returns fitness when yoga is not present", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Pilates Class\r\nDESCRIPTION:Core workout\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("fitness");
  });

  it("handles SUMMARY with parameters (e.g. SUMMARY;LANGUAGE=en:)", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY;LANGUAGE=en:Yoga Class\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("yoga");
  });

  it("handles folded (continuation) lines", () => {
    const vevent = [
      "BEGIN:VEVENT",
      "SUMMARY:Long Event Name That Gets",
      " Folded And Contains Yoga Here",
      "END:VEVENT",
    ].join("\r\n");
    expect(classifyEvent(vevent)).toBe("yoga");
  });

  it("does not match yoga in unrelated fields", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Pilates\r\nX-CUSTOM:yoga\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("fitness");
  });

  it("returns fitness for run club even if yoga appears elsewhere", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Run Club\r\nDESCRIPTION:Meet at the yoga studio\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("fitness");
  });

  it("returns fitness for run club (case-insensitive)", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:TRC RUN CLUB\r\nEND:VEVENT";
    expect(classifyEvent(vevent)).toBe("fitness");
  });
});

// --------------- buildPrompt ---------------

describe("buildPrompt", () => {
  it("includes the class name and description", () => {
    const prompt = buildPrompt("Morning Flow", "A 60-minute yoga class.");
    expect(prompt).toContain("Class name: Morning Flow");
    expect(prompt).toContain("A 60-minute yoga class.");
  });

  it("instructs for concise third-person output", () => {
    const prompt = buildPrompt("Yoga", "Some description");
    expect(prompt).toMatch(/third person/i);
    expect(prompt).toMatch(/concise/i);
  });

  it("instructs to omit admin details", () => {
    const prompt = buildPrompt("Yoga", "Some description");
    expect(prompt).toMatch(/signup/i);
    expect(prompt).toMatch(/administrative/i);
  });
});
