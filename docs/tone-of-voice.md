# Tone of Voice — راهنمای لحن (Persian Copy Guide)

How آزمون‌ساز speaks. Everything quoted here is real shipping copy, cited from
source. The register is **مکاتبه‌ای محترمانه** — the politeness of official
Persian correspondence, warmed by the fact that both sides of the product
(teachers and students) are doing honest work.

Companion: `docs/brand-meraj.md` (the physical metaphor), `docs/illustration-system.md`.

---

## 1. The one-line register

> The product writes like a trusted school secretary who has sealed a
> thousand exams: calm, precise, never gushing, never cold.

The Sealing Ceremony caption is the register's anchor — when in doubt, tune to it:

> **آزمون با موفقیت مهر و موم شد** (`SealCeremony.tsx`)

Short declarative, verb last, no exclamation mark, one graceful compound
(مهر و موم) doing the branding work without naming the brand.

---

## 2. Ten laws

1. **Verb-last declaratives.** State outcomes, not excitement:
   «پاسخ شما با موفقیت در سامانه ثبت نهایی شد.» (SubmittedScreen) —
   not «هورا! پاسخ شما ثبت شد 🎉».
2. **No exclamation marks in system copy.** They are allowed only in
   deliberate human-warm exceptions, at most one per screen — e.g.
   «موردی برای تصحیح یافت نشد!» (Dashboard) earns its mark because the empty
   state is talking *to* a teacher about their own classroom, not announcing.
3. **Never blame the user.** Errors describe the *state*, then the *way out*:
   «هیچ آزمونی با ویژگی‌های بالا یافت نشد. اولین سنجش خود را راه‌اندازی کنید.»
   (Exams). No «شما اشتباه کردید», no «ورودی نامعتبر!» alone.
4. **Every empty state ends in a door.** Title states the absence plainly
   («آزمونی یافت نشد»), description offers the next action, the Button carries
   it («طراحی آزمون نو»). The action verb is an invitation (کنید, بگذارید), never
   a command (کن!).
5. **Formal pronouns, consistently.** شما everywhere, always. No تو, no slang,
   no mixing registers mid-flow. This is the رسمی half of the register.
6. **Numeral law:** every number a human reads is Persian digits —
   `toPersianDigits` (`src/utils/persian.ts`) or `toLocaleString('fa')`.
   «شما ۱۲ پاسخ همگام‌نشدهٔ آفلاین دارید.» (SubmittedScreen). Latin digits only
   in machine surfaces (IDs, URLs, logs, code).
7. **Half-space (نیم‌فاصله) is grammar, not styling:** می‌شود، دانش‌آموزان،
   همگام‌نشدهٔ، ویژگی‌های. The ZWNJ + هٔ forms are part of the house style
   (همگام‌نشدهٔ above is the model). A missing نیم‌فاصله reads as a typo, because
   it is one.
8. **Terminology is a fixed table** (§3). One concept, one word, forever.
   Synonym rotation («امتحان» vs «آزمون») is banned — the product is
   آزمون‌ساز and the noun is آزمون.
9. **Length follows the tier:** title ≤ 6 words, description 1–2 sentences,
   toast 1 sentence, dialog body ≤ 3 sentences. If a dialog needs a fourth
   sentence, it needs a help page instead.
10. **The four elements stay literal** (paper, ink, seal, light): sealing
    language for commitments (ثبت نهایی، مهر و موم، انتشار), drafting language
    for creation (طراحی، پیش‌نویس), light/glass language for transparency
    (شفافیت). Metaphors never stack two-deep in one sentence.

---

## 3. Terminology table

| Concept | Say | Never |
|---|---|---|
| Exam | آزمون | امتحان، تست |
| Student | دانش‌آموز | کاربر (in UI copy), ادمین دانش‌آموز |
| Teacher | دبیر / معلم | کاربر، اکانت |
| Publish (exam) | انتشار آزمون | آپلود، عمومی کردن |
| Final submit (exam-taking) | ثبت نهایی | سابمیت، تایید نهایی |
| Grading | تصحیح | چک کردن، تصحیح کردن جواب‌ها |
| Offline sync | همگام‌سازی | سینک، آپلود مجدد |
| Class | کلاس | گروه، بخش |
| Question bank | بانک سؤال | مخزن، آرشیو |
| Answer sheet | پاسخ‌برگ | فرم، شیت |

---

## 4. Message-type recipes

**Success (full-panel, Seal moment):**
Title states the completion; body is absent or one sentence; the Seal art does
the celebrating. «آزمون با موفقیت منتشر شد» — never + «!», never + emoji.

**Progress / neutral info:** one sentence, present tense, no opinion.
«در حال بارگذاری بانک سؤال…» — ellipsis only when the wait is real.

**Error:** `[state] + [way out]`, danger color carries the severity so the
words can stay calm. «اتصال قطع شد. پاسخ‌ها محفوظ‌اند و پس از بازگشت ارسال می‌شوند.»
The reassurance (محفوظ‌اند) is part of the recipe wherever student data is
involved — anxiety is the enemy the whole brand exists to defeat.

**Confirmation dialog:** question form, verb-last, explicit object.
«حذف پرونده دانش‌آموز» (title) / «خروج بدون ذخیره؟» (Students.tsx). The
destructive button names the action («حذف کن»), the safe one names the escape
(«انصراف»).

**Offline / queued (the empathy centerpiece):**
«شما ۱۲ پاسخ همگام‌نشدهٔ آفلاین دارید. ابتدا تلاش شود پاسخ‌ها به سرور ارسال شوند؟»
(SubmittedScreen) — states the count in Persian digits, explains the order of
operations, asks permission. This is the register at its most characteristic:
procedural calm that respects a student mid-exam.

---

## 5. What the product never says

- Never marketing speak inside the tool («بهترین پلتفرم…», «قدرت گرفته از…»).
- Never urgency theatre («فقط ۳ ثانیه دیگر!», «عجله کنید!»). Deadlines are
  shown by the countdown with numbers, not adjectives.
- Never bot-speak («عملیات با موفقیت انجام گردید» ×3 on one screen). Vary the
  verb: ثبت شد، منتشر شد، ذخیره شد، مهر و موم شد — each moment picks its word.
- Never truncated Persian with «...» as a design choice; use a longer container
  or the hint tier.

---

## 6. Review checklist (for any PR with new copy)

- [ ] Verb-last declaratives; no exclamation marks outside the earned exception
- [ ] Persian digits (`toPersianDigits`) on every human-read number
- [ ] نیم‌فاصله and هٔ correct throughout
- [ ] Terminology table honored (no امتحان, no سینک)
- [ ] Error = state + way out; empty state ends in a door (title → description → action)
- [ ] Tier lengths: title ≤6 words, description ≤2 sentences, toast ≤1
- [ ] One metaphor deep, drawn from paper/ink/seal/light
- [ ] Screen readers get meaning, not decoration (art is aria-hidden)
