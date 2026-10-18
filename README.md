# Stillspace

A study-space explorer for Punjab Engineering College, Chandigarh, with a frosted-glass interface and a circular clock for testing different dates and times.

Explore imported CSE timetables, check full-interval schedule conflicts, save room references, and inspect the scanned source behind each entry.

## Quick start

Requires **Python 3.9 or later**. No packages or build step are needed to run the app.

```sh
git clone https://github.com/mayank-grover/seProject.git
cd seProject
python3 run.py
```

Open [localhost:5173](http://localhost:5173). Stop the server with **Ctrl+C**. On Windows, use `python run.py` if `python3` is unavailable.

The launcher serves only the `dist/` directory and works regardless of your current working directory. To use another port:

```sh
python3 run.py --port 8000
```

It binds to `127.0.0.1` by default. Use `--host 0.0.0.0` only when you want the app accessible from other devices on your network.

### Node alternative

Node.js 18 or later can also serve the app without installing dependencies:

```sh
npm run dev
```

Both launchers use port 5173 by default; run one at a time. Refresh your browser after editing files.

## Features

- Search rooms by name or type for a 30, 60, 90, or 120 minute stay.
- Check schedule conflicts across every mapped branch for the entire requested interval.
- Switch between cards and a list, inspect teaching-day timelines, and open room details.
- Browse a weekly room timetable, with an optional branch display filter.
- Keep saved rooms and private room notes in your browser.
- Enable **Testing mode** to change the date and time using the circular 24-hour slider, exact inputs, 15-minute buttons, and presets.
- Adjust the clock with arrow keys in 5-minute steps, or Shift + arrow keys in hourly steps.
- Review scanned timetable pages and unmapped cells; export normalized JSON or CSV.

Saved rooms and notes are local to the browser. Notes are not shared observations and do not change schedule status. Search always checks all mapped branches, even when the weekly table is filtered.

## Project structure

```text
seProject/
├── run.py                         # Python standard-library launcher
├── server.mjs                     # Node alternative
├── README.md
├── package.json                   # Run, test, and format commands
├── package-lock.json
├── requirements-dev.txt           # Python formatter
├── .editorconfig                  # Shared editor whitespace settings
├── .prettierrc.json
├── .prettierignore
├── .gitignore
├── .openai/
│   └── hosting.json               # Existing private Sites configuration
├── dist/                          # Deployable static application
│   ├── index.html
│   ├── style.css
│   ├── app.mjs                     # Interface and browser-local state
│   ├── engine.mjs                  # Interval checks and campus-time logic
│   ├── data.json                   # Data used by the app
│   └── assets/                     # Scanned source pages as WebP images
├── data/
│   ├── ocr-cells.json              # Extracted timetable cells
│   └── normalized-timetable.json   # Room mappings and source provenance
├── tools/
│   ├── import_pdf.py              # OCR adapter for the supplied PDF
│   └── normalize_timetable.py     # Venue mapping and deduplication
└── tests/
    ├── engine.test.mjs            # Interval, timezone, and data tests
    └── browser.cjs                # Optional Chrome interaction checks
```

## Development and formatting

Install development dependencies only when you need formatting:

```sh
npm ci
npm run format
npm run format:check
```

JavaScript, HTML, CSS, JSON, and Markdown use Prettier. Python uses Black:

```sh
python3 -m pip install -r requirements-dev.txt
python3 -m black run.py tools
python3 -m black --check run.py tools
```

Binary source scans and PDFs are not formatted. The original PDF documents are excluded from Git; extracted data and timetable scans are included.

## Tests

Run the automated interval and normalized-data checks with Node.js:

```sh
npm test
```

The tests cover half-open time boundaries, partial overlaps, invalid intervals and dates, source-period limits, weekends, IST conversion, deduplication, and source/room integrity. An event starting exactly at the requested end does not overlap the stay.

For the optional browser checks, install Playwright without changing the project's dependency files and use an installed Google Chrome:

```sh
npm install --no-save --package-lock=false playwright
```

Start either local server, then run in another terminal:

```sh
node tests/browser.cjs
```

The browser checks exercise clock dragging and keyboard controls, date presets, filtering, source scans, private notes, saved-room persistence, weekly branches, export, unknown-date handling, real-time reset, and mobile overflow. Screenshots are written to `/tmp`. Chrome layouts were reviewed at 1440px and 390px widths; Firefox and Safari have not been verified.

## Timetable data

The source is the 12-page PEC **Finalized Class-wise Time Table for B.Tech CSE, CSE(DS), CSE(AI), and M.Tech CSE, Semester 2026–27–1**, effective **09 October 2026**. Page 1 is the cover; pages 2–12 contain schedules.

The current import contains:

| Item                        | Count |
| --------------------------- | ----: |
| Distinct nonempty cells     |   355 |
| Mapped schedule entries     |   263 |
| Room references             |    29 |
| Cells without mapped venues |    92 |

The OCR adapter identifies table cells, recognizes individual crops, and removes exact duplicates. Mapped events retain their branch, weekday, start/end times in minutes after midnight, and source page. Cross-source entries retain their separate provenance.

### Recreate the import

This is optional; the app already includes the imported data. Requires Python packages `pdfplumber`, `Pillow`, and `numpy`, plus the `tesseract` command-line tool:

```sh
python3 -m pip install pdfplumber Pillow numpy
python3 tools/import_pdf.py '/absolute/path/to/timetable.pdf'
python3 tools/normalize_timetable.py
npm test
```

The adapter is specific to the supplied scanned PDF layout. Review it before using another timetable. Keep the original PDF unchanged.

## Coverage and limitations

**A “CSE schedule gap” is not proof that a room is empty, unlocked, or approved for study.** It only means no mapped event from this partial departmental source overlaps the full requested interval.

- All OCR entries are provisional. Compare them with the included scans, particularly merged cells, shared electives, and HSM groups.
- Numeric references such as `405` and `L405` are assumed aliases. The lab classification of 3xx, 402, and CL spaces is provisional. Multiple venues in one cell conservatively block every mapped room.
- Other departments, room closures, cancellations, holidays, and academic-calendar exceptions are incomplete or unknown.
- The prototype review horizon is **09 October–31 December 2026**, based on the source's Jul–Dec description. December 31 is not a confirmed semester-end date.
- Weekends and intervals outside **08:00–18:00** return unknown. This review window is not a claim about opening hours. The weekly overview displays recurrence patterns independently of the selected date's validity.
- Capacity, quietness, amenities, floors, actual occupancy, and study permission are unverified. No geographic location is inferred from a room number.
- There is no authentication, shared database, shared reporting/moderation, geographic campus map, live sensor feed, reservation system, or trained occupancy model.

The app is a static, browser-local prototype. Google Fonts are optional; system fonts are used when unavailable. No actual-availability probabilities are invented.
