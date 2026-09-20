import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  WRITE_GLOSS_SKILL_RELS,
  checkFollowupPrompt,
  maintainGlossPrompt,
  writeGlossPrompt,
  type CheckPromptItem,
} from "../src/lib/agent-prompt.js";

describe("write-gloss skill paths", () => {
  test("covers Cursor, Claude, and .agents", () => {
    assert.deepEqual([...WRITE_GLOSS_SKILL_RELS], [
      ".cursor/skills/write-gloss/SKILL.md",
      ".claude/skills/write-gloss/SKILL.md",
      ".agents/skills/write-gloss/SKILL.md",
    ]);
  });
});

describe("prompts", () => {
  test("writeGlossPrompt names the skill and check", () => {
    const p = writeGlossPrompt();
    assert.match(p, /write-gloss/);
    assert.match(p, /dualine check/);
    assert.match(p, /不生成笔记/);
  });

  test("maintainGlossPrompt asks for check --json", () => {
    const p = maintainGlossPrompt();
    assert.match(p, /dualine check --json/);
    assert.match(p, /--fix/);
    assert.match(p, /--accept/);
  });

  test("checkFollowupPrompt is clean when there are no items", () => {
    assert.match(checkFollowupPrompt([]), /没有要改的/);
  });

  test("checkFollowupPrompt splits move / drift / missing", () => {
    const items: CheckPromptItem[] = [
      {
        note: "gloss.md",
        loc: "c1.p1.a1",
        message: "moved",
        reason: "range",
        file: "src/a.ts",
        start: 1,
        end: 3,
        suggest: { start: 8, end: 10 },
      },
      {
        note: "gloss.md",
        loc: "c2.p1.a1",
        message: "code changed since gloss.lock",
        reason: "drift",
        file: "src/b.ts",
        start: 4,
        end: 6,
      },
      {
        note: "gloss.md",
        loc: "c3.p1.a1",
        message: "missing: src/nope.ts",
        reason: "missing",
        file: "src/nope.ts",
        start: 1,
        end: 1,
      },
    ];
    const p = checkFollowupPrompt(items);
    assert.match(p, /dualine check --fix/);
    assert.match(p, /代码正文已经变了/);
    assert.match(p, /src\/b\.ts#L4-L6/);
    assert.match(p, /落不到文件里/);
    assert.match(p, /src\/nope\.ts/);
  });
});
