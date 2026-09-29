# 07 — Motion guidelines (GSAP, used with restraint)

DevDeck is a utility. Motion explains change; it never performs. Use the installed GSAP skills
(`gsap-core`, `gsap-timeline`, `gsap-react`, `gsap-performance`). ScrollTrigger is not needed.

## Where motion is allowed
- List rows entering/leaving after a refresh or a stop (fade + 4px shift, 160ms).
- Confirm dialog and popover open/close (fade + scale from 0.98, 140ms).
- Status change flash on a row (background tint fades out over 400ms).
- Toast in/out.
- Optional: gentle count-up on totals (only when values change).

## Rules
1. Durations 120–200ms; easing `power2.out` in, `power2.in` out. No bounces or springs.
2. Animate `opacity` and `transform` only. No layout-thrashing properties.
3. React: use `useGSAP` with a scoped ref, clean up via context; never leave tweens running when a view unmounts.
4. Respect `prefers-reduced-motion` through `gsap.matchMedia()`: reduced = instant state changes.
5. Never animate on every 3s poll tick. Animate only real changes (row added/removed/state changed).
6. Nothing loops. No idle animation. No parallax.
7. Keep bundle small: import only `gsap` core and `@gsap/react`.

## Snippet (row enter)
```tsx
useGSAP(() => {
  const mm = gsap.matchMedia()
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.row.is-new', { opacity: 0, y: 4, duration: 0.16, ease: 'power2.out', stagger: 0.02 })
  })
}, { scope: listRef, dependencies: [newIds.join()] })
```
