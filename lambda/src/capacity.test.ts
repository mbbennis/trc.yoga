import {
  decodeHtmlEntities,
  extractOfferingUrl,
  extractOfferingGuid,
  parseDatesData,
  utcToLocalDate,
} from "./capacity";

// --------------- decodeHtmlEntities ---------------

describe("decodeHtmlEntities", () => {
  it("decodes &amp; to &", () => {
    expect(decodeHtmlEntities("foo&amp;bar")).toBe("foo&bar");
  });

  it("decodes &lt; and &gt;", () => {
    expect(decodeHtmlEntities("&lt;div&gt;")).toBe("<div>");
  });

  it("decodes &quot; and &#39;", () => {
    expect(decodeHtmlEntities('say &quot;hello&#39;s&quot;')).toBe(`say "hello's"`);
  });

  it("decodes multiple &amp; in a URL", () => {
    expect(decodeHtmlEntities("a=1&amp;b=2&amp;c=3")).toBe("a=1&b=2&c=3");
  });

  it("returns text unchanged when no entities present", () => {
    expect(decodeHtmlEntities("plain text")).toBe("plain text");
  });
});

// --------------- extractOfferingUrl ---------------

describe("extractOfferingUrl", () => {
  const sampleVevent = [
    "BEGIN:VEVENT",
    "SUMMARY:Yoga Flow",
    "DTSTART:20260317T140000Z",
    "URL:https://app.rockgympro.com/b/widget/?a=offering&amp;offering_guid=c852cb15&amp;widget_guid=ddfa32c0&amp;mode=e",
    "END:VEVENT",
  ].join("\r\n");

  it("extracts and decodes URL from VEVENT", () => {
    const url = extractOfferingUrl(sampleVevent);
    expect(url).toContain("offering_guid=c852cb15");
    expect(url).not.toContain("&amp;");
  });

  it("swaps mode=e to mode=p", () => {
    const url = extractOfferingUrl(sampleVevent);
    expect(url).toContain("mode=p");
    expect(url).not.toContain("mode=e");
  });

  it("returns undefined when no URL field present", () => {
    const vevent = "BEGIN:VEVENT\r\nSUMMARY:Yoga\r\nEND:VEVENT";
    expect(extractOfferingUrl(vevent)).toBeUndefined();
  });

  it("returns undefined when URL has no offering_guid", () => {
    const vevent = "BEGIN:VEVENT\r\nURL:https://example.com/page\r\nEND:VEVENT";
    expect(extractOfferingUrl(vevent)).toBeUndefined();
  });

  it("handles URL with LF line endings", () => {
    const vevent = [
      "BEGIN:VEVENT",
      "URL:https://app.rockgympro.com/b/widget/?a=offering&amp;offering_guid=abc123&amp;mode=e",
      "END:VEVENT",
    ].join("\n");
    const url = extractOfferingUrl(vevent);
    expect(url).toContain("offering_guid=abc123");
    expect(url).toContain("mode=p");
  });

  it("handles folded URL continuation lines", () => {
    const vevent = [
      "BEGIN:VEVENT",
      "URL:https://app.rockgympro.com/b/widget/?a=offering&amp;offering_gu",
      " id=abc123&amp;widget_guid=xyz&amp;mode=e",
      "END:VEVENT",
    ].join("\r\n");
    const url = extractOfferingUrl(vevent);
    expect(url).toContain("offering_guid=abc123");
    expect(url).toContain("mode=p");
  });

  it("preserves mode=p if already set", () => {
    const vevent = [
      "BEGIN:VEVENT",
      "URL:https://app.rockgympro.com/b/widget/?a=offering&amp;offering_guid=abc&amp;mode=p",
      "END:VEVENT",
    ].join("\r\n");
    const url = extractOfferingUrl(vevent);
    expect(url).toContain("mode=p");
  });
});

// --------------- extractOfferingGuid ---------------

describe("extractOfferingGuid", () => {
  it("extracts offering_guid from a full URL", () => {
    const url = "https://app.rockgympro.com/b/widget/?a=offering&offering_guid=c852cb1537154797ae5b39329dd92bf3&widget_guid=ddfa32c0&mode=p";
    expect(extractOfferingGuid(url)).toBe("c852cb1537154797ae5b39329dd92bf3");
  });

  it("returns undefined for URL without offering_guid", () => {
    expect(extractOfferingGuid("https://example.com/page")).toBeUndefined();
  });

  it("returns undefined for invalid URL", () => {
    expect(extractOfferingGuid("not a url")).toBeUndefined();
  });

  it("handles offering_guid as the only parameter", () => {
    const url = "https://example.com/?offering_guid=abc123";
    expect(extractOfferingGuid(url)).toBe("abc123");
  });
});

// --------------- parseDatesData ---------------

describe("parseDatesData", () => {
  it("parses dates_data from realistic HTML", () => {
    const html = `
      <html><body>
      <script>
      var dates_data = {"2026-03-17":{"sold_out":false,"session_number":1,"is_available":true,"specific_datetimes":["2026-03-17 12:45:00"]},"2026-03-19":{"sold_out":true,"session_number":1,"is_available":false,"specific_datetimes":["2026-03-19 12:45:00"]}};
      var other_data = {};
      </script>
      </body></html>
    `;
    const data = parseDatesData(html);
    expect(data).toBeDefined();
    expect(data!["2026-03-17"].sold_out).toBe(false);
    expect(data!["2026-03-17"].is_available).toBe(true);
    expect(data!["2026-03-19"].sold_out).toBe(true);
    expect(data!["2026-03-19"].is_available).toBe(false);
  });

  it("returns undefined when dates_data is not present", () => {
    const html = "<html><body>no script here</body></html>";
    expect(parseDatesData(html)).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    const html = 'var dates_data = {broken json};';
    expect(parseDatesData(html)).toBeUndefined();
  });

  it("handles dates_data with extra whitespace", () => {
    const html = `var dates_data  =  {"2026-01-01":{"sold_out":false,"session_number":1,"is_available":true,"specific_datetimes":[]}};`;
    const data = parseDatesData(html);
    expect(data).toBeDefined();
    expect(data!["2026-01-01"].is_available).toBe(true);
  });

  it("handles empty dates_data object", () => {
    const html = "var dates_data = {};";
    const data = parseDatesData(html);
    expect(data).toEqual({});
  });
});

// --------------- utcToLocalDate ---------------

describe("utcToLocalDate", () => {
  it("converts UTC afternoon to same Eastern date (EST)", () => {
    // 2026-01-15T14:00:00Z → 9:00 AM ET (EST, UTC-5) → 2026-01-15
    expect(utcToLocalDate("20260115T140000Z")).toBe("2026-01-15");
  });

  it("converts UTC midnight to previous Eastern date (EST)", () => {
    // 2026-01-16T00:00:00Z → 7:00 PM ET Jan 15 (EST, UTC-5)
    expect(utcToLocalDate("20260116T000000Z")).toBe("2026-01-15");
  });

  it("converts UTC early morning to previous Eastern date (EST)", () => {
    // 2026-01-16T04:00:00Z → 11:00 PM ET Jan 15 (EST, UTC-5)
    expect(utcToLocalDate("20260116T040000Z")).toBe("2026-01-15");
  });

  it("converts UTC 05:00 to same Eastern date (EST)", () => {
    // 2026-01-16T05:00:00Z → 12:00 AM ET Jan 16 (EST, UTC-5)
    expect(utcToLocalDate("20260116T050000Z")).toBe("2026-01-16");
  });

  it("handles EDT (summer time, UTC-4)", () => {
    // 2026-07-15T14:00:00Z → 10:00 AM ET (EDT, UTC-4) → 2026-07-15
    expect(utcToLocalDate("20260715T140000Z")).toBe("2026-07-15");
  });

  it("handles DST spring-forward boundary (March 8, 2026)", () => {
    // DST starts March 8, 2026 at 2:00 AM ET
    // 2026-03-08T06:00:00Z → 1:00 AM EST (before spring-forward) → 2026-03-08
    expect(utcToLocalDate("20260308T060000Z")).toBe("2026-03-08");
    // 2026-03-08T07:00:00Z → 3:00 AM EDT (after spring-forward) → 2026-03-08
    expect(utcToLocalDate("20260308T070000Z")).toBe("2026-03-08");
  });

  it("handles DST fall-back boundary (November 1, 2026)", () => {
    // DST ends November 1, 2026 at 2:00 AM ET
    // 2026-11-01T05:00:00Z → 1:00 AM EDT (before fall-back) → 2026-11-01
    expect(utcToLocalDate("20261101T050000Z")).toBe("2026-11-01");
    // 2026-11-01T06:00:00Z → 1:00 AM EST (after fall-back) → 2026-11-01
    expect(utcToLocalDate("20261101T060000Z")).toBe("2026-11-01");
  });

  it("handles dtstart without trailing Z", () => {
    // Should still parse correctly
    expect(utcToLocalDate("20260317T140000")).toBe("2026-03-17");
  });
});
