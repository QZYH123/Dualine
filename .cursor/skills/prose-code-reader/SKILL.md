---
name: prose-code-reader
description: Use when building or refining the prose↔code paired reading experience—layout, anchors, scroll sync, sample fixtures, or mapping prose blocks to code spans.
---

# Prose ↔ Code reader

## Goal
A reader finishes a short guided pass and feels they **grasp** the project—not that they read a blog or scrolled a repo.

## Reading ritual (default)
1. Left (or primary): short chapters of prose with inline anchors.
2. Right: code viewport showing the linked span, highlighted.
3. Selecting a prose anchor focuses code; selecting code can scroll to the explaining prose when a reverse map exists.
4. Keep chrome thin: title, chapter list, maybe a “sample project” switcher—nothing that competes with reading.

## Content quality
- Prose depth: between jargon dump and baby talk—name real structures, show why they exist, point at code.
- Every major claim should have a code target.
- Sample fixtures must look like a real small app, not lorem.

## Implementation notes
- Prefer fixtures first so UI can be judged without a perfect backend.
- When backend is needed, delegate to the `backend` subagent with a clear contract (e.g. `GET /project/:id/guide` returning sections + ranges).
