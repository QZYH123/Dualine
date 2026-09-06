import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { getHighlighter } from "./lib/highlight";
import {
  loadProject,
  requestedProjectId,
  type Catalog,
  type LoadResult,
} from "./lib/load";
import { noticeShowsBack } from "./lib/notice";
import { Reader } from "./reader/Reader";
import { Wordmark } from "./reader/Masthead";

export default function App() {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [loaded, setLoaded] = useState<LoadResult | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getHighlighter(), loadProject(requestedProjectId())]).then(([hl, result]) => {
      if (!alive) return;
      setHighlighter(hl);
      setLoaded(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loaded?.kind === "project") document.title = `${loaded.project.name} · Gloss 对照`;
  }, [loaded]);

  if (!highlighter || !loaded) {
    return <div className="loading">对照</div>;
  }

  if (loaded.kind === "project") {
    return (
      <Reader
        project={loaded.project}
        highlighter={highlighter}
        source={loaded.source}
        warnings={loaded.warnings}
      />
    );
  }

  return <Notice result={loaded} />;
}

/*
 * The screen when there is nothing to face: the project asked for is not
 * there, the folder is missing or empty, or the API is. Same quiet centre as
 * the loading state — one line of Chinese, one line of mono that says exactly
 * where to look.
 */
function Notice({ result }: { result: Exclude<LoadResult, { kind: "project" }> }) {
  const catalog = "catalog" in result ? result.catalog : undefined;
  const title = noticeTitle(result);
  const hint = noticeHint(result);
  const tip = noticeTip(result);
  const projects = catalog?.projects ?? [];

  return (
    <div className="loading notice" role="status">
      <div>
        <Wordmark as="p" />
        <p className="notice__title">{title}</p>
        <p className="notice__hint">{hint}</p>
        {tip && <p className="notice__tip">{tip}</p>}
        {projects.length > 0 && result.kind === "not-found" && (
          <ul className="notice__projects">
            {projects.map((p) => (
              <li key={p.id}>
                <a href={`/?project=${encodeURIComponent(p.id)}`}>{p.id}</a>
                {p.tagline ? <span>{p.tagline}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {noticeShowsBack(result.kind) && (
          <a className="notice__back" href="/">
            返回
          </a>
        )}
      </div>
    </div>
  );
}

function noticeTitle(result: Exclude<LoadResult, { kind: "project" }>): string {
  switch (result.kind) {
    case "not-found":
      return `找不到项目 “${result.id}”`;
    case "unreachable":
      return "API 未运行，读不到这个项目";
    case "empty":
      return "这个目录下没有项目";
    case "no-dir":
      return result.catalog.rootStatus === "not-directory"
        ? "项目路径不是一个目录"
        : "找不到项目目录";
  }
}

function noticeHint(result: Exclude<LoadResult, { kind: "project" }>): string {
  switch (result.kind) {
    case "not-found":
      return projectPath(result.catalog, result.id);
    case "unreachable":
      return "npm run dev:all";
    case "empty":
      return projectPath(result.catalog, "<id>");
    case "no-dir":
      return result.catalog.root ?? "GLOSS_PROJECTS_DIR";
  }
}

function noticeTip(result: Exclude<LoadResult, { kind: "project" }>): string | null {
  switch (result.kind) {
    case "not-found":
      return result.catalog.projects.length > 0 ? "这个目录里还有" : "每个项目一个子文件夹，内含 gloss.md";
    case "unreachable":
      return null;
    case "empty":
      return "每个项目一个子文件夹，内含 gloss.md";
    case "no-dir":
      return "设置 GLOSS_PROJECTS_DIR 指向一个文件夹";
  }
}

function projectPath(catalog: Catalog, id: string): string {
  return catalog.root ? `${catalog.root}/${id}/gloss.md` : `GLOSS_PROJECTS_DIR/${id}/gloss.md`;
}
