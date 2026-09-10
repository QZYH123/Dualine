import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import {
  allPassages,
  buildReverseIndex,
  resolveRefs,
  type AnchorInline,
  type CodeRef,
  type Project,
} from "../lib/gloss";
import { CATALOG_DEFAULT_HINT, warningStripExpandable, warningStripText } from "../lib/notice";
import { Masthead, Wordmark } from "./Masthead";
import { Rail } from "./Rail";
import { Prose } from "./Prose";
import { CodePane } from "./CodePane";
import { useReadingSync } from "./useReadingSync";

interface ReaderProps {
  project: Project;
  highlighter: HighlighterCore;
  source: "api" | "sample";
  warnings: string[];
  /** True when the URL has no `?project=` — the catalog's first listed id. */
  catalogDefault?: boolean;
}

function readToken(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

export function Reader({ project, highlighter, source, warnings, catalogDefault = false }: ReaderProps) {
  const { doc, files } = project;
  const warnText = warningStripText(warnings);

  const passages = useMemo(() => allPassages(doc), [doc]);
  const refById = useMemo(() => resolveRefs(doc), [doc]);
  const reverse = useMemo(() => buildReverseIndex(doc), [doc]);
  const anchorById = useMemo(() => {
    const m = new Map<string, AnchorInline>();
    for (const p of passages) for (const a of p.anchors) m.set(a.id, a);
    return m;
  }, [passages]);
  const chapterOfPassage = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of passages) m.set(p.id, p.chapterId);
    return m;
  }, [passages]);

  const [currentPassageId, setCurrentPassageId] = useState<string | null>(null);
  const [hoverAnchorId, setHoverAnchorId] = useState<string | null>(null);
  const [pinnedAnchorId, setPinnedAnchorId] = useState<string | null>(null);

  const scrollRef: CodeRef | null = currentPassageId ? (refById.get(currentPassageId) ?? null) : null;
  const pinnedRef = pinnedAnchorId ? (anchorById.get(pinnedAnchorId)?.ref ?? null) : null;
  const activeRef = pinnedRef ?? scrollRef;
  const hoverRef = hoverAnchorId ? (anchorById.get(hoverAnchorId)?.ref ?? null) : null;

  const activeFile = activeRef ? (files[activeRef.file] ?? null) : null;
  const currentChapterId = currentPassageId ? (chapterOfPassage.get(currentPassageId) ?? null) : null;
  const currentChapter = doc.chapters.find((c) => c.id === currentChapterId) ?? null;

  const proseRef = useRef<HTMLElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const codeRef = useRef<HTMLDivElement | null>(null);

  const tokens = useMemo(
    () => ({
      codeLine: readToken("--code-line", 22),
      header: readToken("--mast-h", 56) + (warnText ? readToken("--warn-strip-h", 32) : 0),
      readingLine: readToken("--reading-line", 0.32),
      alignDuration: readToken("--dur-align", 460),
    }),
    [warnText],
  );

  useReadingSync(
    { prose: proseRef, gutter: gutterRef, bridge: bridgeRef, codeViewport: viewportRef, code: codeRef },
    {
      activeRef,
      pinnedAnchorId,
      codeLineHeight: tokens.codeLine,
      headerHeight: tokens.header,
      readingLine: tokens.readingLine,
      alignDuration: tokens.alignDuration,
      onCurrentPassage: setCurrentPassageId,
    },
  );

  const onAnchorClick = useCallback((id: string) => {
    setPinnedAnchorId((prev) => (prev === id ? null : id));
  }, []);

  const unpin = useCallback(() => setPinnedAnchorId(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") unpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unpin]);

  /*
   * Reverse ritual: a code line is clicked, the prose comes to it.
   * The passage that explains the line is scrolled to the reading line; once
   * the page settles, the anchor is pinned so the code holds still while the
   * reader takes the explanation in.
   */
  const settleTimer = useRef<number | null>(null);
  const jumpToAnchor = useCallback(
    (anchorId: string) => {
      const prose = proseRef.current;
      const anchorEl = prose?.querySelector<HTMLElement>(`[data-anchor="${anchorId}"]`);
      const passageEl = anchorEl?.closest<HTMLElement>("[data-passage]");
      if (!anchorEl || !passageEl) return;

      setHoverAnchorId(null);

      const lineY = tokens.header + (window.innerHeight - tokens.header) * tokens.readingLine;
      const delta = passageEl.getBoundingClientRect().top - (lineY - 6);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (Math.abs(delta) < 2 || reduced) {
        window.scrollBy({ top: delta, behavior: "auto" });
        setPinnedAnchorId(anchorId);
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("scrollend", finish);
        window.removeEventListener("scroll", bump);
        if (settleTimer.current) window.clearTimeout(settleTimer.current);
        setPinnedAnchorId(anchorId);
      };
      // Fallback for browsers without `scrollend`: pin once scrolling goes quiet.
      const bump = () => {
        if (settleTimer.current) window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(finish, 140);
      };
      window.addEventListener("scrollend", finish, { once: true });
      window.addEventListener("scroll", bump, { passive: true });
      bump();
      window.scrollBy({ top: delta, behavior: "smooth" });
    },
    [tokens],
  );

  const onSelectChapter = useCallback((chapterId: string) => {
    unpin();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(chapterId)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }, [unpin]);

  return (
    <>
      <div className="notice viewport-notice" role="status">
        <div>
          <Wordmark as="p" />
          <p className="notice__title">对照需要更宽的窗口</p>
          <p className="notice__hint">≥ 1100px</p>
        </div>
      </div>
      <div className="session">
        <Masthead
          name={project.name}
          tagline={project.tagline}
          chapter={currentChapter}
          chapters={doc.chapters}
          pinned={pinnedAnchorId !== null}
          sample={source === "sample"}
          onSelectChapter={onSelectChapter}
        />
        {warnText && (
          <WarnStrip warnings={warnings} label={warnText} catalogDefault={catalogDefault} />
        )}
        <main className="reader">
          <Rail chapters={doc.chapters} currentChapterId={currentChapterId} onSelect={onSelectChapter} />

          <article className="prose" ref={proseRef}>
            <Prose
              doc={doc}
              currentPassageId={currentPassageId}
              hoverAnchorId={hoverAnchorId}
              pinnedAnchorId={pinnedAnchorId}
              onAnchorHover={setHoverAnchorId}
              onAnchorClick={onAnchorClick}
            />
          </article>

          <div className="gutter" ref={gutterRef} aria-hidden="true">
            <div className="bridge" ref={bridgeRef} />
          </div>

          <CodePane
            file={activeFile}
            focus={activeRef}
            hover={hoverRef}
            hits={activeFile ? reverse.get(activeFile.path) : undefined}
            pinned={pinnedAnchorId !== null}
            highlighter={highlighter}
            viewportRef={viewportRef}
            codeRef={codeRef}
            onUnpin={unpin}
            onLineHover={setHoverAnchorId}
            onLineClick={jumpToAnchor}
          />
        </main>
      </div>
    </>
  );
}

function WarnStrip({
  warnings,
  label,
  catalogDefault,
}: {
  warnings: string[];
  label: string;
  catalogDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expandable = warningStripExpandable(warnings);
  const why = catalogDefault ? <span className="warn-strip__why">{CATALOG_DEFAULT_HINT}</span> : null;
  const expandTitle = "查看无法落地的锚点";
  const title = expandable
    ? catalogDefault
      ? `${expandTitle} · ${CATALOG_DEFAULT_HINT}`
      : expandTitle
    : catalogDefault
      ? CATALOG_DEFAULT_HINT
      : undefined;

  const warningKey = warnings.join("\n");
  useEffect(() => {
    setOpen(false);
  }, [warningKey]);

  if (!expandable) {
    return (
      <p className="warn-strip" role="status" title={title}>
        {label}
        {why}
      </p>
    );
  }

  return (
    <div className="warn-strip-wrap">
      <button
        type="button"
        className={"warn-strip warn-strip--many" + (open ? " is-open" : "")}
        aria-expanded={open}
        aria-controls="warn-strip-detail"
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        {why}
      </button>
      {open && (
        <ul id="warn-strip-detail" className="warn-strip__list" role="status">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
