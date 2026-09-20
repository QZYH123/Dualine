/** Where `dualine init` copies write-gloss, relative to the project folder. */
export const WRITE_GLOSS_SKILL_RELS = [
  ".cursor/skills/write-gloss/SKILL.md",
  ".claude/skills/write-gloss/SKILL.md",
  ".agents/skills/write-gloss/SKILL.md",
] as const;

export interface CheckPromptItem {
  note: string;
  loc: string;
  message: string;
  reason: "outside" | "missing" | "range" | "drift" | "lock" | "unlocked" | "id";
  file: string;
  start: number;
  end: number;
  suggest?: { start: number; end: number };
  ambiguous?: number;
}

export function writeGlossPrompt(): string {
  return [
    "读项目里的 write-gloss 技能，为这个项目写 gloss.md。",
    "技能文件：.cursor/skills/write-gloss/SKILL.md（若没有，看 .claude/skills 或 .agents/skills 下同名文件）。",
    "写完运行 dualine check .，0 problems 后再 dualine .。",
    "不要另写一篇来替换现有正文，除非用户要你重写。Dualine 只读，不生成笔记。",
  ].join("\n");
}

/** Static instruction the reader copies. The agent then runs `check --json`. */
export function maintainGlossPrompt(): string {
  return [
    "请在本项目文件夹里维护 Dualine 对照笔记：",
    "1. 运行 dualine check --json",
    "2. 按输出里的 prompt 做。能挪的锚点用 dualine check --fix；代码正文变了的，重读那些行并改 gloss.md，再 dualine check --accept。",
    "3. 写作规范见 write-gloss 技能（.cursor/skills/write-gloss/SKILL.md；若没有，看 .claude/skills 或 .agents/skills 下同名文件）。",
    "不要从代码生成一篇新笔记来替换现有正文，除非用户要你重写。阅读器不改磁盘。",
  ].join("\n");
}

function spanLabel(file: string, start: number, end: number): string {
  if (!file) return "";
  return start === end ? `${file}#L${start}` : `${file}#L${start}-L${end}`;
}

/** Dynamic follow-up from a `dualine check --json` run. */
export function checkFollowupPrompt(items: readonly CheckPromptItem[]): string {
  if (items.length === 0) {
    return "锚点都落在代码上。没有要改的。";
  }

  const movable = items.filter((i) => i.suggest && i.ambiguous == null);
  const changed = items.filter((i) => i.reason === "drift" && !i.suggest);
  const ambiguous = items.filter((i) => i.ambiguous != null);
  const broken = items.filter(
    (i) =>
      i.reason === "missing" ||
      i.reason === "outside" ||
      i.reason === "id" ||
      (i.reason === "range" && !i.suggest),
  );
  const bookkeeping = items.filter((i) => i.reason === "lock" || i.reason === "unlocked");

  const lines: string[] = [
    "这是 Dualine 对照笔记的维护说明。按下面做，不要另写一篇来替换现有 gloss.md。",
  ];

  let n = 1;
  if (movable.length > 0) {
    lines.push(
      `${n}. 有锚点只是行号挪了：在项目文件夹运行 dualine check --fix。只改行号，不改字。`,
    );
    n += 1;
  }
  if (changed.length > 0) {
    lines.push(
      `${n}. 下面这些锚点面对的代码正文已经变了。请打开那些行，重读并改 gloss.md 里对应段落，然后 dualine check --accept：`,
    );
    for (const p of changed) {
      const span = spanLabel(p.file, p.start, p.end);
      lines.push(`   - ${p.note} ${p.loc}${span ? ` → ${span}` : ""}：${p.message}`);
    }
    n += 1;
  }
  if (ambiguous.length > 0) {
    lines.push(`${n}. 下面这些原文出现不止一处，需要人手改锚点：`);
    for (const p of ambiguous) {
      const span = spanLabel(p.file, p.start, p.end);
      lines.push(`   - ${p.note} ${p.loc}${span ? ` → ${span}` : ""}：${p.message}`);
    }
    n += 1;
  }
  if (broken.length > 0) {
    lines.push(`${n}. 下面这些锚点落不到文件里，请改 gloss.md 里的路径或行号，再 dualine check .：`);
    for (const p of broken) {
      const span = spanLabel(p.file, p.start, p.end);
      lines.push(`   - ${p.note} ${p.loc}${span ? ` → ${span}` : ""}：${p.message}`);
    }
    n += 1;
  }
  if (bookkeeping.length > 0) {
    lines.push(
      `${n}. 有锚点还不在 gloss.lock 里。行号合法的话，跑 dualine check --accept 写入锁。`,
    );
  }
  return lines.join("\n");
}
