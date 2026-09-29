# v2 — Unified log viewer

## Acceptance criteria
- [ ] Combine logs from several containers and local processes in one timeline with source labels
- [ ] Filter by source, level, text/regex; saved filters; JSON log pretty-printing
- [ ] Follow/pause, jump to time, copy selection, export to file
- [ ] Virtualized rendering, memory cap, backpressure handling
- [ ] Local process logs via user-chosen log files (tail) — never scraping other processes' memory

## Notes
Merge streams in main by arrival time with monotonic sequence ids; batch to renderer. Keep parsing rules in pure, tested functions.
