/*
 * The reading ritual, mechanised.
 *
 * A horizontal "reading line" sits about a third of the way down the viewport.
 * The passage whose top has most recently crossed it is *current*. The code
 * pane translates its content so the first line of the span that passage faces
 * sits level with the passage's first line; as you scroll, both move together.
 * When the current passage changes, the code eases into its new alignment.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { CodeRef } from "../lib/gloss";

export interface SyncRefs {
  prose: RefObject<HTMLElement | null>;
  gutter: RefObject<HTMLElement | null>;
  bridge: RefObject<HTMLElement | null>;
  codeViewport: RefObject<HTMLElement | null>;
  code: RefObject<HTMLElement | null>;
}

export interface SyncOptions {
  activeRef: CodeRef | null;
  /** When pinned, the code stays put and aligns to the pinned anchor element. */
  pinnedAnchorId: string | null;
  codeLineHeight: number;
  headerHeight: number;
  readingLine: number; // 0..1 of the viewport below the header
  alignDuration: number;
  onCurrentPassage: (id: string | null) => void;
}

function cssPx(el: Element, prop: string): number {
  return parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

export function useReadingSync(refs: SyncRefs, opts: SyncOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const manualOffset = useRef(0);
  const lastTransform = useRef(0);
  const lastBridgeY = useRef(0);
  const lastKey = useRef<string>("");
  const alignTimer = useRef<number | null>(null);
  const currentId = useRef<string | null>(null);
  const pinnedY = useRef<number | null>(null);
  const pinnedScrollY = useRef<number | null>(null);

  // Apply the stored offset immediately when the code element remounts
  // (file switch) so the new file appears already aligned.
  // Use `top`, not `transform` — a transform on `.code` would pin sticky
  // line numbers to the file instead of the pane.
  useLayoutEffect(() => {
    const code = refs.code.current;
    if (code) code.style.top = `${lastTransform.current}px`;
  });

  useEffect(() => {
    let frame = 0;

    const beginAlign = () => {
      const { code, bridge } = refs;
      code.current?.classList.add("is-aligning");
      bridge.current?.classList.add("is-aligning");
      if (alignTimer.current) window.clearTimeout(alignTimer.current);
      alignTimer.current = window.setTimeout(() => {
        code.current?.classList.remove("is-aligning");
        bridge.current?.classList.remove("is-aligning");
      }, optsRef.current.alignDuration + 40);
    };

    const update = () => {
      frame = 0;
      const o = optsRef.current;
      const prose = refs.prose.current;
      const viewport = refs.codeViewport.current;
      const code = refs.code.current;
      const gutter = refs.gutter.current;
      const bridge = refs.bridge.current;
      if (!prose || !viewport || !gutter || !bridge) return;

      const vh = window.innerHeight;
      const lineY = o.headerHeight + (vh - o.headerHeight) * o.readingLine;

      // 1. Which passage is current?
      const passages = prose.querySelectorAll<HTMLElement>("[data-passage]");
      let current: HTMLElement | null = null;
      for (const el of passages) {
        const top = el.getBoundingClientRect().top;
        if (top <= lineY) current = el;
        else break;
      }
      if (!current && passages.length) current = passages[0];
      const id = current?.dataset.passage ?? null;
      if (id !== currentId.current) {
        currentId.current = id;
        o.onCurrentPassage(id);
      }

      // 2. Where should the code sit?
      const viewportRect = viewport.getBoundingClientRect();
      const gutterRect = gutter.getBoundingClientRect();
      const proseLine = current ? cssPx(current, "line-height") : 32;
      const ref = o.activeRef;

      let alignY: number | null = null;
      let bridgeAllowed = true;
      if (o.pinnedAnchorId) {
        if (pinnedY.current == null) {
          const a = prose.querySelector<HTMLElement>(`[data-anchor="${o.pinnedAnchorId}"]`);
          const rect = a?.getClientRects()[0] ?? a?.getBoundingClientRect();
          pinnedY.current = rect ? rect.top + rect.height / 2 : lineY;
          pinnedScrollY.current = window.scrollY;
        }
        alignY = pinnedY.current;
        // Once the reader scrolls on, the phrase has left; the bridge would lie.
        bridgeAllowed = Math.abs(window.scrollY - (pinnedScrollY.current ?? 0)) < 8;
      } else {
        pinnedY.current = null;
        pinnedScrollY.current = null;
        if (current) alignY = current.getBoundingClientRect().top + proseLine / 2;
      }

      if (!ref || alignY == null || !code) {
        bridge.classList.remove("is-visible");
        return;
      }

      const key = `${ref.file}#${ref.start}:${o.pinnedAnchorId ?? ""}`;
      if (key !== lastKey.current) {
        if (lastKey.current) beginAlign();
        lastKey.current = key;
        manualOffset.current = 0;
      }

      // Centre of the span's first code line should meet alignY.
      const spanTopInCode = (ref.start - 1) * o.codeLineHeight;
      let translate = alignY - o.codeLineHeight / 2 - viewportRect.top - spanTopInCode;

      // Keep the span from sliding off the top while a long passage is read.
      const minTranslate = 14 - spanTopInCode;
      if (translate < minTranslate) translate = minTranslate;

      // Never leave the top of the file below the reading line.
      const maxTranslate = lineY - viewportRect.top;
      if (translate > maxTranslate) translate = maxTranslate;

      translate += manualOffset.current;

      lastTransform.current = translate;
      code.style.top = `${translate}px`;

      // 3. The bridge: a hairline from the passage to its lines.
      const spanCentreY = viewportRect.top + translate + spanTopInCode + o.codeLineHeight / 2;
      const bridgeY = Math.round(spanCentreY - gutterRect.top);
      lastBridgeY.current = bridgeY;
      bridge.style.transform = `translate3d(0, ${bridgeY}px, 0)`;
      const visible = spanCentreY > viewportRect.top + 4 && spanCentreY < viewportRect.bottom - 4;
      bridge.classList.toggle("is-visible", visible && bridgeAllowed && manualOffset.current === 0);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const onScroll = () => {
      if (manualOffset.current !== 0) {
        manualOffset.current = 0;
        beginAlign();
      }
      schedule();
    };

    // Wheel over the code pane scrolls the code, not the page.
    const onWheel = (e: WheelEvent) => {
      const viewport = refs.codeViewport.current;
      const code = refs.code.current;
      if (!viewport || !code) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // let horizontal scroll through
      e.preventDefault();
      const vh = viewport.clientHeight;
      const contentH = code.scrollHeight;
      const base = lastTransform.current - manualOffset.current;
      const next = manualOffset.current - e.deltaY;
      const total = base + next;
      const clampedTotal = Math.min(vh * 0.4, Math.max(-(contentH - vh * 0.5), total));
      manualOffset.current = clampedTotal - base;
      code.classList.remove("is-aligning");
      schedule();
    };

    const viewport = refs.codeViewport.current;
    viewport?.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    if (refs.prose.current) ro.observe(refs.prose.current);
    schedule();

    return () => {
      viewport?.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (alignTimer.current) window.clearTimeout(alignTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run alignment whenever the discrete inputs change.
  useEffect(() => {
    pinnedY.current = null;
    window.dispatchEvent(new Event("resize"));
  }, [opts.activeRef?.file, opts.activeRef?.start, opts.activeRef?.end, opts.pinnedAnchorId]);
}
