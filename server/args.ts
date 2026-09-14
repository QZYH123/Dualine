export type CliArgs =
  | { cmd: "help" }
  | { cmd: "version" }
  | { cmd: "serve"; dir: string; open: boolean }
  | { cmd: "check"; dir: string; accept: boolean; fix: boolean; dryRun: boolean }
  | { cmd: "export"; dir: string; out?: string }
  | { cmd: "init"; dir: string }
  | { cmd: "error"; message: string };

const SUBS = new Set(["check", "export", "init"]);

function positionalAndFlags(argv: string[]): {
  rest: string[];
  flags: Set<string>;
  out?: string;
  error?: string;
} {
  const rest: string[] = [];
  const flags = new Set<string>();
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--out") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { rest, flags, error: "--out needs a directory" };
      }
      out = next;
      i += 1;
      continue;
    }
    if (a.startsWith("--out=")) {
      const value = a.slice("--out=".length);
      if (!value) return { rest, flags, error: "--out needs a directory" };
      out = value;
      continue;
    }
    if (a.startsWith("-")) {
      flags.add(a);
      continue;
    }
    rest.push(a);
  }
  return { rest, flags, out };
}

function unknownFlag(flags: Set<string>, allowed: Set<string>): string | null {
  for (const f of flags) {
    if (!allowed.has(f)) return `unknown flag: ${f}`;
  }
  return null;
}

export function parseArgv(argv: string[]): CliArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { cmd: "help" };
  if (argv.includes("--version") || argv.includes("-v")) return { cmd: "version" };

  const head = argv[0];
  if (head && SUBS.has(head)) {
    return parseSub(head, argv.slice(1));
  }
  return parseServe(argv);
}

function parseServe(argv: string[]): CliArgs {
  const { rest, flags, error } = positionalAndFlags(argv);
  if (error) return { cmd: "error", message: error };
  const unknown = unknownFlag(flags, new Set(["--no-open"]));
  if (unknown) return { cmd: "error", message: unknown };
  if (rest.length > 1) return { cmd: "error", message: `unexpected argument: ${rest[1]}` };
  return { cmd: "serve", dir: rest[0] ?? ".", open: !flags.has("--no-open") };
}

function parseSub(cmd: string, argv: string[]): CliArgs {
  const { rest, flags, out, error } = positionalAndFlags(argv);
  if (error) return { cmd: "error", message: error };
  if (rest.length > 1) return { cmd: "error", message: `unexpected argument: ${rest[1]}` };
  const dir = rest[0] ?? ".";

  if (cmd === "check") {
    const unknown = unknownFlag(flags, new Set(["--accept", "--fix", "--dry-run"]));
    if (unknown) return { cmd: "error", message: unknown };
    return {
      cmd: "check",
      dir,
      accept: flags.has("--accept"),
      fix: flags.has("--fix"),
      dryRun: flags.has("--dry-run"),
    };
  }
  if (cmd === "export") {
    const unknown = unknownFlag(flags, new Set());
    if (unknown) return { cmd: "error", message: unknown };
    return out === undefined ? { cmd: "export", dir } : { cmd: "export", dir, out };
  }
  const unknown = unknownFlag(flags, new Set());
  if (unknown) return { cmd: "error", message: unknown };
  return { cmd: "init", dir };
}
