import { buildPrompt } from "./describe";

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
