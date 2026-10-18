# Stillspace

A responsive PEC study-space prototype with a liquid-glass-inspired interface, built from the supplied CSE class timetables. It runs without an install or framework build.

## Run

```sh
npm run dev
# http://127.0.0.1:5173
npm test
```

## Implemented

- Room search by name and type; 30, 60, 90 or 120 minute stays.
- Interval-wide conflicts across every mapped branch, with start-inclusive/end-exclusive boundaries.
- Cards and list views, teaching-day occupancy strips, room details and upcoming entries.
- Weekly room timetables, with an optional branch display filter. Search never ignores other branches.
- Saved rooms and explicitly private room notes persisted to browser localStorage.
- IST campus clock; testing mode with a pointer and keyboard accessible circular 24-hour slider, exact date/time inputs, 15-minute steps and boundary/weekend presets.
- Scanned source pages, unmapped-cell review and normalized JSON/CSV exports.
- Data provenance, explicit uncertainty, source-period and weekend handling.

## Data and limitations

Source: “Finalized Class-wise Time Table for B.Tech (CSE, CSE(DS), CSE(AI), and M.Tech (CSE) Sem 26-27-1 w.e.f. 09.10.2026.pdf”, 12 scanned pages; page 1 is the cover and pages 2–12 are schedules. The provided SRS was used as project context, not as instructions to execute.

The OCR adapter extracts cell geometry and then recognizes each crop. Exact duplicate cells are removed. The current import contains **355 distinct nonempty cells, 263 mapped events, 29 room references and 92 cells without mapped venues**. All OCR is provisional and must be compared with the included scans. Generic electives, HSM groups and merged cells can be incomplete or ambiguous. Numeric room references (e.g. 405 and L405) are assumed aliases; 3xx, 402 and CL spaces are provisional lab classifications. No floor or building position is inferred from room numbers. Multiple references in one cell conservatively block every mapped room for that interval. Cross-source entries retain their provenance.

The source describes Jul–Dec 2026 and is effective from 09 October. The prototype uses **09 Oct–31 Dec 2026** as its review horizon; Dec 31 is not an official semester end. It conservatively returns unknown on weekends and outside the reviewed 08:00–18:00 search window. This window is not an opening-hours claim. Holidays, cancellations and academic exceptions are unknown. A weekly overview shows recurring entries even outside the date horizon and is labeled accordingly.

“CSE schedule gap” means only that no mapped event from this partial departmental source overlaps the interval. Actual occupancy, locking, capacity, quietness, amenities and permission to study are unknown. The app does **not** claim a room is eligible for study, reserve rooms or present an invented availability probability.

This is a static, browser-local MVP. Authentication, a shared database, authenticated reports/moderation, a verified room inventory, geographic map and trained ML require additional inputs and are not implemented. Private notes are not shared observations and do not change availability. Font loading is optional (Google Fonts); system fallbacks work offline when the app is served locally.

## Recreate the import

Requires Python with `pdfplumber`, `Pillow`, `numpy`, and the `tesseract` CLI. The PDF layout adapter is specific to the supplied source.

```sh
python3 tools/import_pdf.py '/absolute/path/to/timetable.pdf'
python3 tools/normalize_timetable.py
npm test
```

`data/ocr-cells.json` retains recognized cells. `data/normalized-timetable.json` and `dist/data.json` contain room mappings, recurrence times in minutes after midnight, branches and source page numbers. Source scans are in `dist/assets`. Keep the source PDF unchanged. A new timetable layout requires adapter review.

## Structure

- `dist/`: deployable static app; `engine.mjs` separates interval and timezone logic from presentation.
- `tools/`: reproducible OCR and mapping pipeline.
- `tests/`: boundary, source-window, timezone and normalized-data integrity tests.
- `server.mjs`: minimal path-restricted local static server.
- `.openai/hosting.json`: private Sites deployment configuration.

## Verification

Eight automated engine/data tests pass. Chrome browser checks cover loading, pointer/keyboard clock controls, date presets, interval filters, source scans, local notes, saved persistence, branch timetables, downloads, unknown-date handling, real-time reset and mobile overflow. Screenshots were reviewed at 1440px and 390px widths. Firefox and Safari have not been verified.

The optional browser check requires Playwright and an installed Chrome; run the preview server first, then `node tests/browser.cjs`. It writes QA screenshots to `/tmp`.
