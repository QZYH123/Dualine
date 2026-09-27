import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { HighlighterCore } from "shiki/core";
import { hitAtLine, type CodeRef, type GlossHit, type ProjectFile } from "../lib/gloss";
import { ensureLanguage, tokenize, type TokenLine } from "../lib/highlight";
import type { Copy } from "../lib/locale";
import { thumbGeometry, translateForThumb } from "./code-scroll";

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
  setTranslate: (px: number) => void;
  revealLine: (line: number) => void;
  copy: Copy;
}

const LANG_LABEL: Record<string, string> = {
  typescript: "TypeScript",
  tsx: "TypeScript",
  javascript: "JavaScript",
  jsx: "JavaScript",
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
  setTranslate,
  revealLine,
  copy,
}: CodePaneProps) {
  const lang = file?.lang ?? "";
  const [grammarGen, setGrammarGen] = useState(0);

  useEffect(() => {
    if (!file || !lang) return;
    if (highlighter.getLoadedLanguages().includes(lang)) return;
    let cancelled = false;
    void ensureLanguage(lang).then((loaded) => {
      if (!cancelled && loaded) setGrammarGen((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [file, lang, highlighter]);

  const lines: TokenLine[] = useMemo(
    () => (file ? tokenize(highlighter, file.content.replace(/\n$/, ""), lang) : []),
    [file, highlighter, lang, grammarGen],
  );

  // Which anchor (if any) explains each line — resolved once per file.
  const hitByLine = useMemo(
    () => lines.map((_, i) => hitAtLine(hits, i + 1)),
    [lines, hits],
  );

  // Whether the current hover originated on the code side (drives the hint).
  const [codeHover, setCodeHover] = useState<GlossHit | null>(null);
  const [moreRight, setMoreRight] = useState(false);
  const [roving, setRoving] = useState<number | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setRoving(preferredGlossLine(hitByLine, inFocus?.start ?? 1, inFocus?.end ?? null));
  }, [file?.path, inFocus?.start, inFocus?.end, hitByLine]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const code = codeRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!viewport || !code || !bar || !thumb) return;

    const apply = () => {
      const contentH = code.scrollHeight;
      const vh = viewport.clientHeight;
      const top = parseFloat(code.style.top) || 0;
      const trackH = bar.clientHeight || vh;
      const g = thumbGeometry(trackH, contentH, vh, top);
      bar.classList.toggle("is-idle", g.range < 1);
      thumb.style.height = `${g.thumbH}px`;
      thumb.style.top = `${g.thumbTop}px`;
      const overflowX = viewport.scrollWidth - viewport.clientWidth > 1;
      const remains = viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1;
      setMoreRight(overflowX && remains);
    };

    apply();
    const mo = new MutationObserver(apply);
    mo.observe(code, { attributes: true, attributeFilter: ["style"] });
    const ro = new ResizeObserver(apply);
    ro.observe(viewport);
    ro.observe(code);
    viewport.addEventListener("scroll", apply, { passive: true });
    return () => {
      mo.disconnect();
      ro.disconnect();
      viewport.removeEventListener("scroll", apply);
    };
  }, [file?.path, lines.length, viewportRef, codeRef]);

  const onBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const viewport = viewportRef.current;
    const code = codeRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!viewport || !code || !bar || !thumb) return;
    e.preventDefault();
    e.stopPropagation();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add("is-active");
    const onThumb = e.target === thumb;
    const startY = e.clientY;
    const startThumb = parseFloat(thumb.style.top) || 0;
    const applyAt = (clientY: number) => {
      const trackH = bar.clientHeight;
      const contentH = code.scrollHeight;
      const vh = viewport.clientHeight;
      const g = thumbGeometry(trackH, contentH, vh, parseFloat(code.style.top) || 0);
      const travel = Math.max(1, trackH - g.thumbH);
      let thumbTop = onThumb
        ? startThumb + (clientY - startY)
        : clientY - bar.getBoundingClientRect().top - g.thumbH / 2;
      thumbTop = Math.min(travel, Math.max(0, thumbTop));
      setTranslate(translateForThumb(contentH, vh, thumbTop, g.thumbH, trackH));
    };
    const move = (ev: PointerEvent) => applyAt(ev.clientY);
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.classList.remove("is-active");
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    if (!onThumb) applyAt(e.clientY);
  };

  const onNumKey = (line: number, e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const hit = hitByLine[line - 1];
      if (hit) onLineClick(hit.anchorId);
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const next = adjacentGlossLine(hitByLine, line, e.key === "ArrowDown" ? 1 : -1);
    if (next == null) return;
    setRoving(next);
    revealLine(next);
    codeRef.current
      ?.querySelector<HTMLElement>(`[data-line="${next}"] .line__num`)
      ?.focus({ preventScroll: true });
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

      <div
        className={"code-pane__viewport" + (moreRight ? " has-more-x" : "")}
        ref={viewportRef}
      >
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
                  onMouseEnter={() => onLineHover(hit?.anchorId ?? null)}
                >
                  <span
                    className="line__num"
                    role={hit ? "button" : undefined}
                    tabIndex={hit ? (n === roving ? 0 : -1) : undefined}
                    title={hit ? copy.lineBackTitle : undefined}
                    aria-label={hit ? copy.lineBackAria(n) : undefined}
                    onMouseEnter={hit ? () => enter(hit) : undefined}
                    onMouseLeave={hit ? () => setCodeHover(null) : undefined}
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
                    onKeyDown={hit ? (e) => onNumKey(n, e) : undefined}
                  >
                    {n}
                  </span>
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
              <span>{copy.fileEnd(name)}</span>
            </div>
          </div>
        )}
        <div
          className="code-scroll is-idle"
          ref={barRef}
          aria-hidden="true"
          onPointerDown={onBarPointerDown}
        >
          <div className="code-scroll__thumb" ref={thumbRef} />
        </div>
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

function preferredGlossLine(
  hits: (GlossHit | null)[],
  start: number,
  end: number | null,
): number | null {
  const from = Math.max(1, start);
  const to = end ?? start;
  for (let n = from; n <= to && n <= hits.length; n++) {
    if (hits[n - 1]) return n;
  }
  for (let n = 1; n <= hits.length; n++) {
    if (hits[n - 1]) return n;
  }
  return null;
}

function adjacentGlossLine(hits: (GlossHit | null)[], line: number, dir: 1 | -1): number | null {
  for (let n = line + dir; n >= 1 && n <= hits.length; n += dir) {
    if (hits[n - 1]) return n;
  }
  return null;
}
