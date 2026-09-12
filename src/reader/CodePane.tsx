import { memo, useMemo, useRef, useState, type RefObject } from "react";
import type { HighlighterCore } from "shiki/core";
import { hitAtLine, type CodeRef, type GlossHit, type ProjectFile } from "../lib/gloss";
import { tokenize, type TokenLine } from "../lib/highlight";
import type { Copy } from "../lib/locale";

interface CodePaneProps {
  file: ProjectFile | null;
  focus: CodeRef | null;
  hover: CodeRef | null;
  /** Anchors pointing into `file`, narrowest span first. */
  hits: GlossHit[] | undefined;
  pinned: boolean;
  highlighter: HighlighterCore;
  viewportRef: RefObject<HTMLDivElement | null>;
  codeRef: RefObject<HTMLDivElement | null>;
  onUnpin: () => void;
  onLineHover: (anchorId: string | null) => void;
  onLineClick: (anchorId: string) => void;
  copy: Copy;
}

const LANG_LABEL: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  python: "Python",
};

export const CodePane = memo(function CodePane({
  file,
  focus,
  hover,
  hits,
  pinned,
  highlighter,
  viewportRef,
  codeRef,
  onUnpin,
  onLineHover,
  onLineClick,
  copy,
}: CodePaneProps) {
  const lines: TokenLine[] = useMemo(
    () => (file ? tokenize(highlighter, file.content.replace(/\n$/, ""), file.lang) : []),
    [file, highlighter],
  );

  // Which anchor (if any) explains each line — resolved once per file.
  const hitByLine = useMemo(
    () => lines.map((_, i) => hitAtLine(hits, i + 1)),
    [lines, hits],
  );

  // Whether the current hover originated on the code side (drives the hint).
  const [codeHover, setCodeHover] = useState<GlossHit | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

  const [dir, name] = splitPath(file?.path ?? "");
  const inFocus = focus && file && focus.file === file.path ? focus : null;
  const inHover = hover && file && hover.file === file.path ? hover : null;

  const enter = (h: GlossHit | null) => {
    setCodeHover(h);
    onLineHover(h?.anchorId ?? null);
  };
  const leave = () => {
    setCodeHover(null);
    onLineHover(null);
  };

  return (
    <aside className="code-pane" aria-label={copy.code}>
      <div className="code-pane__head">
        <span className="code-pane__path">
          {dir && <span className="code-pane__dir">{dir}/</span>}
          <span className="code-pane__file">{name || "—"}</span>
        </span>
        <span className="code-pane__meta">
          <span className={"code-pane__hint" + (codeHover ? " is-visible" : "")} aria-live="polite">
            {codeHover && <>{rangeLabel(codeHover.ref)} · {copy.backToNote} ↩</>}
          </span>
          {inFocus && !codeHover && <span className="code-pane__span">{rangeLabel(inFocus)}</span>}
          {file && !pinned && <span>{LANG_LABEL[file.lang] ?? file.lang}</span>}
          {file && !pinned && <span>{copy.lines(lines.length)}</span>}
          {pinned && (
            <button type="button" className="code-pane__pin" onClick={onUnpin}>
              {copy.pinned} <kbd>Esc</kbd> {copy.unpin}
            </button>
          )}
        </span>
      </div>

      <div className="code-pane__viewport" ref={viewportRef}>
        {!file && <p className="code-pane__empty">{copy.emptyCode}</p>}
        {file && (
          <div
            key={file.path}
            ref={codeRef}
            className={"code" + (inFocus ? " has-focus" : "")}
            role="presentation"
            onMouseLeave={leave}
          >
            {lines.map((tokens, i) => {
              const n = i + 1;
              const hit = hitByLine[i];
              const isFocus = inFocus ? n >= inFocus.start && n <= inFocus.end : false;
              const isHover = inHover ? n >= inHover.start && n <= inHover.end : false;
              const cls =
                "line" +
                (isFocus ? " is-focus" : "") +
                (isHover ? " is-hover" : "") +
                (hit ? " has-gloss" : "");
              return (
                <div
                  key={n}
                  className={cls}
                  data-line={n}
                  role={hit ? "button" : undefined}
                  tabIndex={hit ? 0 : undefined}
                  title={hit ? copy.lineBackTitle : undefined}
                  aria-label={hit ? copy.lineBackAria(n) : undefined}
                  onMouseEnter={() => enter(hit)}
                  onMouseDown={
                    hit
                      ? (e) => {
                          dragOrigin.current = { x: e.clientX, y: e.clientY };
                        }
                      : undefined
                  }
                  onClick={
                    hit
                      ? (e) => clickGlossLine(hit.anchorId, onLineClick, dragOrigin.current, e)
                      : undefined
                  }
                  onKeyDown={
                    hit
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onLineClick(hit.anchorId);
                          }
                        }
                      : undefined
                  }
                >
                  <span className="line__num">{n}</span>
                  <span className="line__text">
                    {tokens.length === 0
                      ? " "
                      : tokens.map((t, j) => (
                          <span key={j} className={`tk-${t.cls}${t.italic ? " tk-italic" : ""}`}>
                            {t.text}
                          </span>
                        ))}
                  </span>
                </div>
              );
            })}
            <div className="code__end" aria-hidden="true">
              <span>∎</span>
              <span>end of {name}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});

function clickGlossLine(
  anchorId: string,
  onLineClick: (id: string) => void,
  origin: { x: number; y: number } | null,
  e: { clientX: number; clientY: number },
) {
  if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 5) return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && (sel.toString() ?? "").length > 0) return;
  onLineClick(anchorId);
}

function rangeLabel(ref: CodeRef): string {
  return ref.start === ref.end ? `L${ref.start}` : `L${ref.start}–${ref.end}`;
}

function splitPath(path: string): [string, string] {
  const i = path.lastIndexOf("/");
  return i === -1 ? ["", path] : [path.slice(0, i), path.slice(i + 1)];
}
