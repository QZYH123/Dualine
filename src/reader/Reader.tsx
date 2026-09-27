import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { HighlighterCore } from "shiki/core";
import {
  allPassages,
  buildReverseIndex,
  resolveRefs,
  type AnchorInline,
  type CodeRef,
  type Project,
} from "../lib/gloss";
import { maintainGlossPrompt } from "../lib/agent-prompt";
import { warningStripExpandable, warningStripText, type ProjectWarning } from "../lib/notice";
import { chapterHref, COPY, htmlLang, type Copy, type Locale } from "../lib/locale";
import { DEFAULT_NOTE_ID, type NoteSummary } from "../lib/notes";
import {
  loadLastNote,
  loadNoteChapter,
  markLastNote,
  saveNoteChapter,
} from "../lib/reading-position";
import { LangSwitch, Masthead, Wordmark } from "./Masthead";
import { Rail } from "./Rail";
import { Prose } from "./Prose";
import { CodePane } from "./CodePane";
import { useCopiedFlag } from "./useCopied";
import { useReadingSync } from "./useReadingSync";

interface ReaderProps {
  project: Project;
  highlighter: HighlighterCore;
  source: "api" | "sample" | "export";
  warnings: ProjectWarning[];
  /** True when the URL has no `?project=` — the catalog's first listed id. */
  catalogDefault?: boolean;
  stale?: boolean;
  locale: Locale;
  noteLocale: Locale;
  note?: string;
  notes?: NoteSummary[];
  onReload?: () => void;
}

function readToken(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

function readingLineY(header: number, fraction: number): number {
  return header + (window.innerHeight - header) * fraction;
}

function chapterUrl(chapterId: string): string {
  return chapterHref(chapterId, window.location);
}

export function Reader({
  project,
  highlighter,
  source,
  warnings,
  catalogDefault = false,
  stale = false,
  locale,
  noteLocale,
  note = DEFAULT_NOTE_ID,
  notes,
  onReload,
}: ReaderProps) {
  const { doc, files } = project;
  const copy = COPY[locale];
  const warnText = warningStripText(warnings, locale);

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
  const [resumeChapterId, setResumeChapterId] = useState<string | null>(null);
  const [lastNoteId, setLastNoteId] = useState<string | null>(null);

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
  const followHash = useRef(false);
  const holdY = useRef(0);

  const tokens = useMemo(
    () => ({
      codeLine: readToken("--code-line", 22),
      header: readToken("--mast-h", 56) + (warnText ? readToken("--warn-strip-h", 32) : 0),
      readingLine: readToken("--reading-line", 0.32),
      alignDuration: readToken("--dur-align", 460),
    }),
    [warnText],
  );

  const sync = useReadingSync(
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

      const lineY = readingLineY(tokens.header, tokens.readingLine);
      const delta = passageEl.getBoundingClientRect().top - (lineY - 6);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const arrive = () => {
        const chapterId = passageEl.closest<HTMLElement>("[data-chapter]")?.dataset.chapter;
        followHash.current = true;
        if (chapterId && window.location.hash !== `#${chapterId}`) {
          history.replaceState(null, "", chapterUrl(chapterId));
        }
        holdY.current = window.scrollY;
        setPinnedAnchorId(anchorId);
      };

      if (Math.abs(delta) < 2 || reduced) {
        window.scrollBy({ top: delta, behavior: "instant" });
        arrive();
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("scrollend", finish);
        window.removeEventListener("scroll", bump);
        if (settleTimer.current) window.clearTimeout(settleTimer.current);
        arrive();
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

  const scrollChapter = useCallback((chapterId: string) => {
    const el = document.getElementById(chapterId);
    if (!el) return;
    const first =
      el.querySelector<HTMLElement>("[data-passage]") ??
      el.querySelector<HTMLElement>(".chapter__head") ??
      el;
    const lineY = readingLineY(tokens.header, tokens.readingLine);
    const delta = first.getBoundingClientRect().top - (lineY - 8);
    window.scrollBy({ top: delta, behavior: "instant" });
  }, [tokens]);

  /** Instant jumps must not let the hash chase them. */
  const holdChapter = useCallback(() => {
    holdY.current = window.scrollY;
    followHash.current = false;
  }, []);

  const onSelectChapter = useCallback((chapterId: string) => {
    unpin();
    if (window.location.hash !== `#${chapterId}`) {
      history.pushState(null, "", chapterUrl(chapterId));
    }
    scrollChapter(chapterId);
    holdChapter();
  }, [unpin, scrollChapter, holdChapter]);

  const booted = useRef(false);
  useLayoutEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const hashId = window.location.hash.replace(/^#/, "");
    const saved = loadNoteChapter(project.id, note);
    const prevNote = loadLastNote(project.id);
    if (prevNote && prevNote !== note) setLastNoteId(prevNote);
    if (hashId && doc.chapters.some((c) => c.id === hashId)) {
      scrollChapter(hashId);
    } else if (saved && doc.chapters.some((c) => c.id === saved)) {
      setResumeChapterId(saved);
      if (window.location.hash !== `#${saved}`) {
        history.replaceState(null, "", chapterUrl(saved));
      }
      scrollChapter(saved);
    }
    holdChapter();
  }, [doc, scrollChapter, holdChapter, project.id, note]);

  useEffect(() => {
    if (!currentChapterId) return;
    saveNoteChapter(project.id, note, currentChapterId);
  }, [project.id, note, currentChapterId]);

  useEffect(() => {
    return () => {
      markLastNote(project.id, note);
    };
  }, [project.id, note]);

  useEffect(() => {
    const onScroll = () => {
      if (followHash.current) return;
      if (Math.abs(window.scrollY - holdY.current) < 32) return;
      followHash.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!currentChapterId || !followHash.current) return;
    if (window.location.hash === `#${currentChapterId}`) return;
    history.replaceState(null, "", chapterUrl(currentChapterId));
  }, [currentChapterId]);

  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id || !doc.chapters.some((c) => c.id === id)) return;
      unpin();
      scrollChapter(id);
      holdChapter();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [doc, unpin, holdChapter, scrollChapter]);

  return (
    <>
      <div className="notice viewport-notice" role="status">
        <div>
          <div className="masthead__brand">
            <Wordmark as="p" />
            <LangSwitch locale={locale} />
          </div>
          <p className="notice__title">{copy.wideWindow}</p>
          <p className="notice__hint">{copy.wideHint}</p>
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
          stale={stale}
          frozen={source === "export"}
          locale={locale}
          noteLocale={noteLocale}
          note={note}
          notes={notes ?? []}
          projectId={project.id}
          copy={copy}
          onReload={onReload}
          onSelectChapter={onSelectChapter}
        />
        {warnText && (
          <WarnStrip
            warnings={warnings}
            label={warnText}
            catalogDefault={catalogDefault}
            copy={copy}
            copyPrompt={source === "api" ? maintainGlossPrompt() : null}
          />
        )}
        <main className="reader">
          <Rail
            chapters={doc.chapters}
            currentChapterId={currentChapterId}
            lastChapterId={resumeChapterId}
            lastNoteId={lastNoteId}
            locale={locale}
            noteLocale={noteLocale}
            note={note}
            notes={notes ?? []}
            projectId={project.id}
            frozen={source === "export"}
            copy={copy}
            onSelect={onSelectChapter}
          />

          <article className="prose" ref={proseRef} lang={htmlLang(noteLocale)}>
            <Prose
              doc={doc}
              currentPassageId={currentPassageId}
              hoverAnchorId={hoverAnchorId}
              pinnedAnchorId={pinnedAnchorId}
              locale={noteLocale}
              copy={copy}
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
            setTranslate={sync.setTranslate}
            revealLine={sync.revealLine}
            copy={copy}
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
  copy,
  copyPrompt,
}: {
  warnings: ProjectWarning[];
  label: string;
  catalogDefault: boolean;
  copy: Copy;
  copyPrompt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const clip = useCopiedFlag();
  const expandable = warningStripExpandable(warnings);
  const why = catalogDefault ? <span className="warn-strip__why">{copy.catalogDefault}</span> : null;
  const expandTitle = copy.warnExpand;
  const title = expandable
    ? catalogDefault
      ? `${expandTitle} · ${copy.catalogDefault}`
      : expandTitle
    : catalogDefault
      ? copy.catalogDefault
      : undefined;

  const warningKey = warnings.map((w) => w.message).join("\n");
  useEffect(() => {
    setOpen(false);
  }, [warningKey]);

  const onCopy = (e: MouseEvent) => {
    e.stopPropagation();
    if (copyPrompt) clip.copy(copyPrompt);
  };

  const copyBtn = copyPrompt ? (
    <button
      type="button"
      className="warn-strip__copy"
      onClick={onCopy}
    >
      {clip.copied ? copy.copied : copy.copyForAgent}
    </button>
  ) : null;

  const body = expandable ? (
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
  ) : (
    <p className="warn-strip" role="status" title={title}>
      {label}
      {why}
    </p>
  );

  return (
    <div className="warn-strip-wrap">
      {body}
      {copyBtn}
      {expandable && open && (
        <ul id="warn-strip-detail" className="warn-strip__list" role="status">
          {warnings.map((w) => (
            <li key={w.message}>
              {w.message}
              {w.suggest && (
                <>
                  {" · "}
                  {copy.warnMoved(w.suggest.start, w.suggest.end)}
                  {" · "}
                  <code>{copy.warnFixCmd}</code>
                </>
              )}
              {w.ambiguous != null && (
                <>
                  {" · "}
                  {copy.warnAmbiguous(w.ambiguous)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
