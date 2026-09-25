# Persian copy and typography audit

_Last reviewed: 2026-09-25_

## Applied rules

- Source copy uses Persian `ی` and `ک`; remaining Arabic variants were normalized repository-wide.
- Persian and Arabic digit variants are normalized at search boundaries.
- Persian half-spaces are retained for compounds such as «دانش‌آموز»، «ذخیره‌نشده» and «خوانده‌نشده».
- UI sentences use Persian punctuation and the ellipsis character where progress is continuing.
- Counts always place the localized number before the noun; unnecessary English-style plural inflection is avoided.
- Technical English labels are either translated or isolated as LTR content.
- Dates, times, relative time, and numbers use the centralized Persian utilities.
- Concise recovery-oriented wording is preferred over blame or implementation detail.

## Terminology decisions

| Preferred | Avoid in new copy | Reason |
| --- | --- | --- |
| آزمون | امتحان when referring to the product entity | Product consistency |
| دانش‌آموز | شاگرد / student | Consistent educational terminology |
| پاسخ‌برگ | submission | Clear teacher-facing term |
| ذخیره | save | Persian primary action |
| همگام‌سازی | sync in visible copy | Clear network state |
| خوانده‌نشده | unread | Notification consistency |

Search keywords may retain synonyms so users can still find destinations with natural alternate terms.
