# Riyadh Metro Map

An unofficial, free map and journey planner for the six lines of the Riyadh Metro.

Type a place or a station (or tap a station on the map) and the planner shows the route with every change, an estimated travel time and the fare. It runs in the browser on phones and computers; there is nothing to install, no account and no tracking of people.

This is an independent, non-commercial project. It is not affiliated with Riyadh Public Transport or the Royal Commission for Riyadh City, and it does not use their logos.

## Languages

Each language has its own page, so search engines can show people the version in their language. The English page follows the visitor's saved or browser language; the others always open in their own language.

| Language | Page |
|---|---|
| English | `index.html` |
| العربية (Arabic) | `ar.html` |
| اردو (Urdu) | `ur.html` |
| हिन्दी (Hindi) | `hi.html` |
| বাংলা (Bengali) | `bn.html` |
| Filipino | `tl.html` |
| Русский (Russian) | `ru.html` |
| Français (French) | `fr.html` |

## What it does

- Routes between places and stations on all six lines (Blue, Red, Orange, Yellow, Green, Purple), showing up to three route options as cards (the fastest, one that changes elsewhere, one with fewer changes) when an option is at most 30% and 10 minutes slower.
- Step-by-step directions, estimated travel time with typical waiting, the fare (one flat 2-hour ticket) and opening-hours warnings for late trips.
- 83 places: sights and the old town (Al Masmak, Deera Square, Souq Al Zal, the gold souq, the National Museum, Al Murabba), towers, parks, malls and souqs, stadiums and arenas (Al-Awwal Park, Kingdom Arena), hospitals, universities, the Diplomatic Quarter, the passport office, both railway stations and the airport. Places can be found by their English or Arabic name, and stations by their Arabic name too. Places more than 1.5 km from a station say so and suggest a bus or taxi for the last part.
- Sharing: copy link, WhatsApp, QR code and a trip card. Every route has its own link.
- English guide pages for search engines: the map as a picture, all stations, timings and fares, the six lines, fifteen places, two stations and three routes. Every page hands off to the planner.

## Data and accuracy

- **Lines, station order, Arabic names and interchanges** are taken from English Wikipedia's line articles and checked against riyadhmetro.org and riyadhmetroguide.com (independent guide sites). The network has 83 distinct stations; all were open by May 2026.
- **Fares**: one 2-hour ticket, SAR 4 standard and SAR 10 first class, with any number of rides and transfers on the metro and buses; 3-, 7- and 30-day passes (Riyadh Public Transport tariff, unchanged since December 2024).
- **Hours**: Saturday to Thursday 05:30–24:00, Friday 10:00–24:00 (since September 2025). Hours change during Ramadan and on holidays.
- **Travel times are estimates.** There is no public timetable, so each hop is estimated as 1 minute for the stop plus running at 70 km/h over the distance along the track. The track is the official line geometry from RCRC open data ("Metro lines in Riyadh 2024", `data/rcrc_metro_lines_2024.geojson`); stations are projected onto it. This gives the Blue Line end to end in about 54 minutes; the builders describe it as just under an hour.
- **Station positions** come from RCRC open data ("Metro stations in Riyadh by metro line and station type", `data/rcrc_metro_stations_2024.csv`, converted to `data/coords_official.csv`), for all 83 stations. The station order and English names in the app match that file; Arabic names keep standard spelling (the file sometimes writes ه for ة).
- **Places**: each place has a sourced position (Wikipedia, OpenStreetMap via Mapcarta, or a Yandex or Google place listing; one source per place in `data/places_sources.json`). The station is the nearest one by the official station positions; an interchange is chosen instead when it is at most 200 m further. Walking time is an estimate (straight-line distance × 1.3 at 80 m a minute) and the app says so, except for the two places where a source gives the walk.

## Files

| Path | Purpose |
|---|---|
| `src/riyadh-metro.html` | The single source of the app: map, data, routing, all eight interface languages. Edit this file, not the generated pages. |
| `tools/build.py` | Builds the eight language pages, the guide pages, `sitemap.xml`, `robots.txt`, `manifest.webmanifest` and `sw.js`. |
| `tools/seo_texts.py` | Per-language page titles, descriptions and the "About this map" text. |
| `tools/seo_config.json` | Which guide pages exist and which routes each one shows. |
| `tools/export_data.js` | Exports the app's data and the routes the guide pages need to `tools/seo_data.json`, using the app's own router. Needs Node and Playwright. |
| `tools/seo_pages.py` | Builds the guide pages; no fact on a guide page is typed by hand. |
| `tools/seo_pages_ar.py` | Builds the same guide pages in Arabic under `ar/` (for searches like «اقرب محطة مترو» or «مواعيد مترو الرياض»), linked to the English ones with hreflang. Arabic titles are `title_ar` / `lead_ar` in `seo_config.json`. |
| `tools/ar_names.json` | Arabic station names (RCRC open data) and place names used on the Arabic guide pages. |
| `tools/render_map.js` | Renders `riyadh-metro-map.png` from the app's own map; with `MAP_LANG=ar` it renders the Arabic `riyadh-metro-map-ar.png` for the Arabic pages. Needs Node and Playwright. |
| `tools/sw.template.js` | Source of `sw.js` (offline support). |
| `data/places_sources.json` | Places with their position, Arabic name and source. |
| `data/stations_src.txt` | Station list with sources, used when the app's data was first built. |

To rebuild after a change:

```
node tools/export_data.js && python3 tools/build.py
```

Set `SITE` for the public address and `GOAT` for the GoatCounter address, for example:
`SITE=https://example.com/ GOAT=https://riyadhmetro.goatcounter.com/count python3 tools/build.py`

## IndexNow (Bing, Yandex and others)

After every push to `main` that changes a page, the GitHub Actions workflow `.github/workflows/indexnow.yml` waits two minutes for GitHub Pages to publish, then sends the changed page addresses to IndexNow, so Bing, Yandex, Seznam and Naver crawl them soon. Google does not use IndexNow; it reads `sitemap.xml`. To send every page in the sitemap, run the workflow by hand: Actions → IndexNow → Run workflow. The key is the file `951ec371cba7cc0386f1ebab2a196c98.txt` in the site root; `tools/indexnow.py` does the sending.

## Report a problem

Use the **Report a problem** button on the site (it opens an e-mail to callmebackemail@protonmail.com with the route details), or open an issue in this repository.
