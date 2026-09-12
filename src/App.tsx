import { useCallback, useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { getHighlighter } from "./lib/highlight";
import {
  loadProject,
  requestedProjectId,
  type LoadResult,
} from "./lib/load";
import { COPY, chromeLocale, glossLocale, homeHref, htmlLang, type Locale } from "./lib/locale";
import { noticeCopy, noticeShowsBack } from "./lib/notice";
import { Reader } from "./reader/Reader";
import { LangSwitch, Wordmark } from "./reader/Masthead";

export default function App() {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [loaded, setLoaded] = useState<LoadResult | null>(null);
  const [tick, setTick] = useState(0);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  useEffect(() => {
    let alive = true;
    setStale(false);
    loadProject(requestedProjectId()).then((result) => {
      if (!alive) return;
      setLoaded(result);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    if (loaded?.kind !== "project" || loaded.source !== "api" || !loaded.rev) return;
    const id = loaded.project.id;
    const seen = loaded.rev;
    const iv = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}/rev`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const body: unknown = await res.json();
        const rev =
          body && typeof body === "object" && typeof (body as { rev?: unknown }).rev === "string"
            ? (body as { rev: string }).rev
            : null;
        if (rev) setStale(rev !== seen);
      } catch {
        /* keep the loaded project; poll is best-effort */
      }
    }, 2500);
    return () => window.clearInterval(iv);
  }, [loaded]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const search = typeof window === "undefined" ? "" : window.location.search;
  const nav = typeof navigator === "undefined" ? undefined : navigator.language;
  const locale =
    loaded?.kind === "project"
      ? chromeLocale(search, loaded.project, nav)
      : chromeLocale(search, undefined, nav);
  const noteLocale =
    loaded?.kind === "project" ? glossLocale(loaded.project.locale, loaded.project.doc) : locale;
  const copy = COPY[locale];

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  useEffect(() => {
    if (loaded?.kind === "project") document.title = copy.documentTitle(loaded.project.name);
    else document.title = copy.defaultTitle;
  }, [loaded, copy]);

  if (!highlighter || !loaded) {
    return <div className="loading">{copy.loading}</div>;
  }

  if (loaded.kind === "project") {
    return (
      <Reader
        key={tick}
        project={loaded.project}
        highlighter={highlighter}
        source={loaded.source}
        warnings={loaded.warnings}
        catalogDefault={requestedProjectId() === null}
        stale={stale}
        locale={locale}
        noteLocale={noteLocale}
        onReload={reload}
      />
    );
  }

  return <Notice result={loaded} locale={locale} />;
}

/*
 * The screen when there is nothing to face: the project asked for is not
 * there, the folder is missing or empty, or the API is. Same quiet centre as
 * the loading state — one line of Chinese, one line of mono that says exactly
 * where to look.
 */
function Notice({
  result,
  locale,
}: {
  result: Exclude<LoadResult, { kind: "project" }>;
  locale: Locale;
}) {
  const catalog = "catalog" in result ? result.catalog : undefined;
  const { title, hint, tip } = noticeCopy(result, locale);
  const copy = COPY[locale];
  const projects = catalog?.projects ?? [];

  return (
    <div className="loading notice" role="status">
      <div>
        <div className="masthead__brand">
          <Wordmark as="p" />
          <LangSwitch locale={locale} />
        </div>
        <p className="notice__title">{title}</p>
        <p className="notice__hint">{hint}</p>
        {tip && <p className="notice__tip">{tip}</p>}
        {projects.length > 0 && result.kind === "not-found" && (
          <ul className="notice__projects">
            {projects.map((p) => (
              <li key={p.id}>
                <a href={homeHref(locale, p.id)}>{p.id}</a>
                {p.tagline ? <span>{p.tagline}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {noticeShowsBack(result.kind) && (
          <a className="notice__back" href={homeHref(locale)}>
            {copy.back}
          </a>
        )}
      </div>
    </div>
  );
}
