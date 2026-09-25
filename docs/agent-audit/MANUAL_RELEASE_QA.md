# Manual release QA required from the product owner

_Date prepared: 2026-09-25_

Automated validation is complete. The items below require a real browser, device, assistive technology, production-like data, or human visual judgment. Do not mark the release manifest final until the critical rows pass.

## What you need to provide

1. A staging deployment built from the delivered source, connected to a non-production Supabase project containing representative exams, students, classes, submissions, and a teacher profile.
2. Access to Safari and Firefox in addition to Chromium. Physical iPhone/Android testing is strongly preferred.
3. One screen-reader pass: VoiceOver on macOS/iOS, NVDA on Windows, or TalkBack on Android.
4. The results of the matrix below. A short note or screenshot is enough for failures; include the page, browser, viewport/device, theme, and reproduction steps.
5. Approval of the final visual appearance in both light and dark modes.

Do **not** send production passwords, service-role keys, student personal data, or `.env` files. Use staging credentials locally or in your deployment platform.

## Critical matrix

For each cell, record Pass, Fail, or Not available.

| Flow | 320 px | 375 px | 768 px | 1024 px | 1440 px |
|---|---|---|---|---|---|
| Teacher login/reset |  |  |  |  |  |
| Dashboard/navigation |  |  |  |  |  |
| Create/edit/publish exam |  |  |  |  |  |
| Questions editor |  |  |  |  |  |
| Students + CSV/XLSX import |  |  |  |  |  |
| Classes + delete/undo |  |  |  |  |  |
| Profile/settings |  |  |  |  |  |
| Student login/start/take/submit |  |  |  |  |  |
| Results/grading |  |  |  |  |  |

Repeat the primary teacher and student exam flows in:

- Chromium
- Firefox
- Safari
- Light mode
- Dark mode
- System mode, followed by changing the OS theme while the app is open

## Exam-safety checks

- Test student exam taking in phone landscape orientation.
- Open and dismiss the virtual keyboard in text and long-answer questions.
- Zoom the browser to 200%; ensure the timer, current question, navigation, and submit action remain reachable.
- Increase OS/browser text size where supported.
- Reload during an in-progress attempt and confirm locally persisted answers return.
- Disconnect the network, answer questions, reconnect, and confirm queued saves synchronize.
- Let a short staging exam expire and confirm automatic submission occurs exactly once.
- Confirm reduced-motion mode removes decorative movement without hiding state changes.

## Keyboard and assistive-technology checks

- Complete teacher and student primary flows using only Tab, Shift+Tab, Enter, Space, arrows, and Escape.
- Confirm every modal traps focus, closes as expected, and restores focus to its trigger.
- Confirm command palette and `G` navigation sequences do not fire while typing in an editor.
- Confirm page headings provide a sensible outline.
- Confirm form errors, offline status, save state, and destructive-action recovery are announced.
- Confirm icon-only controls have understandable names.
- Confirm the exam timer is discoverable but does not announce every second.

## Contrast and forced-colors checks

- Measure text and controls over translucent surfaces in both themes using browser accessibility tools.
- Verify normal text reaches 4.5:1 and large text/UI boundaries reach 3:1 where WCAG requires it.
- On Windows High Contrast/forced-colors, confirm focus rings, controls, dialogs, and overlays remain distinguishable.

## Performance evidence requested

On one representative low-end Android device or throttled Chromium profile:

- Record a React Profiler trace while answering and navigating several questions.
- Confirm the full exam page does not commit once per second; only the timer subtree should update.
- Report any interaction that visibly exceeds roughly 100 ms or drops input.

## Production-like data checks

Using staging data only:

- Save and reload teacher biography, avatar, schools, and schedule.
- Import valid and invalid CSV/XLSX files.
- Exercise empty, loading, error, retry, and populated states.
- Verify class deletion undo before five seconds and backend commit afterward.
- Verify no mock badge, fixture account, or inspection-gallery route appears in the production build.

## Returning results

Send back:

- The completed matrix or a list of unavailable environments.
- Failure screenshots or recordings.
- Console errors associated with failures.
- Whether light and dark appearance are approved.
- Whether the provisional 93/100 score and known limitations are accepted.

After those results are available, the draft release manifest can be finalized and the remaining manual checklist items can be marked honestly.
