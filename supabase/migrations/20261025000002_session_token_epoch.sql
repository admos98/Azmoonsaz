-- BE-3 fix: pin_reset could not evict an outstanding session bearer token.
-- Student tokens are stateless JWTs bound only to (sid, eid, stid); the
-- pin_reset re-admit path flips the SAME session row back to 'ongoing', so a
-- squatter's pre-reset token became valid again the moment the legitimate
-- student rejoined — both parties writing into one session until TTL expiry.
--
-- token_epoch is the revocation counter: bumped (to Date.now()) on every
-- pin_reset re-admit, embedded in every minted token as `tep`, and checked
-- against the row on exam-payload / save-answer / submit. Pre-reset bearers
-- now fail with 401 immediately.
alter table public.student_exam_sessions
  add column if not exists token_epoch bigint not null default 0;
