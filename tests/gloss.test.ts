import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  allPassages,
  buildProject,
  buildReverseIndex,
  cjkNumeral,
  hitAtLine,
  inlineText,
  parseGloss,
  parseInlines,
  parseRef,
  resolveRefs,
  splitFrontmatter,
} from "../src/lib/gloss.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("splitFrontmatter / parseGloss frontmatter", () => {
  test("reads simple yaml-ish keys", () => {
    const { meta, body } = splitFrontmatter(
      "---\nname: shortly\ntagline: hi\n---\n# Title\n",
    );
    assert.equal(meta.name, "shortly");
    assert.equal(meta.tagline, "hi");
    assert.equal(body.trimStart().startsWith("# Title"), true);
  });

  test("missing frontmatter leaves body intact", () => {
    const src = "# Title\n\nLead.\n";
    const { meta, body } = splitFrontmatter(src);
    assert.deepEqual(meta, {});
    assert.equal(body, src);
    const parsed = parseGloss(src);
    assert.deepEqual(parsed.meta, {});
    assert.equal(parsed.doc.title, "Title");
  });

  test("unclosed frontmatter is treated as body", () => {
    const src = "---\nname: x\n\n# Title\n\nLead.\n";
    const { meta, body } = splitFrontmatter(src);
    assert.deepEqual(meta, {});
    assert.equal(body, src);
    const { doc } = parseGloss(src);
    assert.equal(doc.title, "Title");
    assert.ok(inlineText(doc.lead).includes("Lead."));
  });

  test("CRLF frontmatter and body", () => {
    const src = "---\r\nname: crlf\r\nlang: python\r\n---\r\n# Hi\r\n\r\nLead para.\r\n";
    const { meta } = splitFrontmatter(src);
    assert.equal(meta.name, "crlf");
    assert.equal(meta.lang, "python");
    const { doc } = parseGloss(src);
    assert.equal(doc.title, "Hi");
    assert.equal(inlineText(doc.lead), "Lead para.");
  });
});

describe("titles, chapters, passages", () => {
  test("# title and lead paragraph", () => {
    const { doc } = parseGloss(
      "# shortly 是怎么工作的\n\nA lead with [x](src/a.ts#L1).\n",
    );
    assert.equal(doc.title, "shortly 是怎么工作的");
    assert.equal(doc.lead[0]?.kind, "text");
    const leadAnchor = doc.lead.find((x) => x.kind === "anchor");
    assert.equal(leadAnchor && leadAnchor.kind === "anchor" && leadAnchor.id, "lead.a1");
    assert.equal(inlineText(doc.lead), "A lead with x.");
  });

  test("## chapters get c1.. ids and passages are numbered across chapters", () => {
    const { doc } = parseGloss(`
# Title

Lead.

## One

First.

Second.

## Two

Third.
`);
    assert.equal(doc.chapters.length, 2);
    assert.equal(doc.chapters[0]?.id, "c1");
    assert.equal(doc.chapters[0]?.index, 1);
    assert.equal(doc.chapters[0]?.title, "One");
    assert.equal(doc.chapters[1]?.id, "c2");
    assert.equal(doc.chapters[1]?.title, "Two");
    const ids = allPassages(doc).map((p) => p.id);
    assert.deepEqual(ids, ["p1", "p2", "p3"]);
    assert.equal(doc.chapters[1]?.passages[0]?.id, "p3");
    assert.equal(doc.chapters[1]?.passages[0]?.chapterId, "c2");
  });
});

describe("cjkNumeral", () => {
  test("samples from 1..25", () => {
    assert.equal(cjkNumeral(1), "一");
    assert.equal(cjkNumeral(10), "十");
    assert.equal(cjkNumeral(11), "十一");
    assert.equal(cjkNumeral(20), "二十");
    assert.equal(cjkNumeral(23), "二十三");
  });
});

describe("anchors and parseRef", () => {
  test("id scheme and children inside a label", () => {
    const { doc } = parseGloss(`
# T

## C

One.

Two.

Third uses [a \`code\` span](src/a.ts#L1) and [two](src/a.ts#L2).
`);
    const p3 = allPassages(doc)[2];
    assert.ok(p3);
    assert.equal(p3.anchors.length, 2);
    assert.equal(p3.anchors[0]?.id, "p3.a1");
    assert.equal(p3.anchors[1]?.id, "p3.a2");
    const kids = p3.anchors[0]?.children ?? [];
    assert.ok(kids.some((k) => k.kind === "code" && k.text === "code"));
  });

  test("parseRef ranges, swap, and rejects", () => {
    assert.deepEqual(parseRef("src/a.ts#L5"), {
      file: "src/a.ts",
      start: 5,
      end: 5,
    });
    assert.deepEqual(parseRef("src/a.ts#L9-L3"), {
      file: "src/a.ts",
      start: 3,
      end: 9,
    });
    assert.deepEqual(parseRef("src/a.ts#L9-3"), {
      file: "src/a.ts",
      start: 3,
      end: 9,
    });
    assert.equal(parseRef("src/a.ts"), null);
    assert.equal(parseRef("src/a.ts#L"), null);
    assert.equal(parseRef("http://x"), null);
    assert.equal(parseRef("src/a ts#L5"), null);
    assert.equal(parseRef("src/a.ts #L5"), null);
  });

  test("explicit @[...] sets passage.ref and is stripped from inlines", () => {
    const { doc } = parseGloss(`
# T

## C

@[src/a.ts#L4-L8]
Hello \`there\`.
`);
    const p = doc.chapters[0]?.passages[0];
    assert.ok(p);
    assert.deepEqual(p.ref, { file: "src/a.ts", start: 4, end: 8 });
    assert.equal(inlineText(p.inlines), "Hello there.");
    assert.equal(
      p.inlines.some((x) => x.kind === "text" && x.text.includes("@[")),
      false,
    );
  });

  test("passage.ref falls back to the first anchor", () => {
    const { doc } = parseGloss(`
# T

## C

See [one](src/a.ts#L1) then [two](src/b.ts#L2).
`);
    const p = doc.chapters[0]?.passages[0];
    assert.deepEqual(p?.ref, { file: "src/a.ts", start: 1, end: 1 });
  });

  test("passage without anchors has ref null; resolveRefs inherits across chapters", () => {
    const { doc } = parseGloss(`
# T

## One

Has [a](src/a.ts#L2-L4).

## Two

No anchors here.
`);
    const first = doc.chapters[0]?.passages[0];
    const second = doc.chapters[1]?.passages[0];
    assert.ok(first && second);
    assert.deepEqual(first.ref, { file: "src/a.ts", start: 2, end: 4 });
    assert.equal(second.ref, null);
    const resolved = resolveRefs(doc);
    assert.deepEqual(resolved.get(first.id), first.ref);
    assert.deepEqual(resolved.get(second.id), first.ref);
  });
});

describe("inlines", () => {
  test("inlineText flattens anchors", () => {
    const inlines = parseInlines("see [foo](src/a.ts#L1) bar", "p1");
    assert.equal(inlineText(inlines), "see foo bar");
  });

  test("code / strong / em / text, unclosed marks degrade to text", () => {
    const tokens = parseInlines("a `c` and **s** plus *e* end", "p1");
    assert.deepEqual(
      tokens.map((t) => t.kind),
      ["text", "code", "text", "strong", "text", "em", "text"],
    );
    assert.deepEqual(parseInlines("see `code", "p1"), [
      { kind: "text", text: "see `code" },
    ]);
    assert.deepEqual(parseInlines("see *italic", "p1"), [
      { kind: "text", text: "see *italic" },
    ]);
    assert.deepEqual(parseInlines("see **bold", "p1"), [
      { kind: "text", text: "see " },
      { kind: "em", text: "" },
      { kind: "text", text: "bold" },
    ]);
  });

  test("a non-ref link stays literal text", () => {
    const tokens = parseInlines("[x](https://example.com)", "p1");
    assert.deepEqual(tokens, [
      { kind: "text", text: "[x](https://example.com)" },
    ]);
  });
});

describe("reverse index", () => {
  test("sorts narrowest span first; hitAtLine picks it", () => {
    const { doc } = parseGloss(`
# T

## C

[wide](src/a.ts#L1-L10) and [narrow](src/a.ts#L3-L4).
`);
    const index = buildReverseIndex(doc);
    const hits = index.get("src/a.ts");
    assert.ok(hits);
    assert.equal(hits[0]?.ref.start, 3);
    assert.equal(hits[0]?.ref.end, 4);
    const narrow = hitAtLine(hits, 3);
    assert.equal(narrow?.ref.start, 3);
    const wide = hitAtLine(hits, 8);
    assert.equal(wide?.ref.start, 1);
    assert.equal(wide?.ref.end, 10);
    assert.equal(hitAtLine(hits, 11), null);
    assert.equal(hitAtLine(undefined, 1), null);
  });
});

describe("buildProject", () => {
  test("lang per extension with frontmatter fallback; name falls back to title", () => {
    const project = buildProject(
      "demo",
      "---\nlang: python\n---\n# Pretty Title\n",
      {
        "a.ts": "x",
        "b.py": "y",
        "c.unknown": "z",
      },
    );
    assert.equal(project.name, "Pretty Title");
    assert.equal(project.lang, "python");
    assert.equal(project.files["a.ts"]?.lang, "typescript");
    assert.equal(project.files["b.py"]?.lang, "python");
    assert.equal(project.files["c.unknown"]?.lang, "python");
  });
});

describe("examples/shortly/gloss.md", () => {
  test("parses end-to-end", () => {
    const src = readFileSync(join(REPO, "examples/shortly/gloss.md"), "utf8");
    const { doc } = parseGloss(src);
    assert.equal(doc.chapters.length, 8);
    const anchors = allPassages(doc).flatMap((p) => p.anchors);
    assert.ok(anchors.length >= 30, `expected ≥30 anchors, got ${anchors.length}`);
    const allowed = new Set([
      "src/index.ts",
      "src/server.ts",
      "src/slug.ts",
      "src/store.ts",
      "src/validate.ts",
    ]);
    for (const a of anchors) {
      assert.ok(allowed.has(a.ref.file), a.ref.file);
    }
    const first = doc.chapters[0]?.passages[0];
    assert.ok(first?.ref, "chapter 1 first passage should have a ref");
  });

  test("L18 reverse prefers the chapter-one teaching span, not a 1-line overlap", () => {
    const src = readFileSync(join(REPO, "examples/shortly/gloss.md"), "utf8");
    const { doc } = parseGloss(src);
    const hits = buildReverseIndex(doc).get("src/server.ts");
    const teaching = hitAtLine(hits, 18);
    assert.equal(teaching?.ref.start, 18);
    assert.equal(teaching?.ref.end, 59);
    const handler = hitAtLine(hits, 19);
    assert.equal(handler?.ref.start, 19);
    assert.equal(handler?.ref.end, 30);
  });
});
