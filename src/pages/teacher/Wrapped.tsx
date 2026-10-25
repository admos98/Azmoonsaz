/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Azmoonsaz Wrapped (Meraj P3) — the teacher's year, told as a legend. One
 * page, one direction (down), stats that answer "what did I build this year":
 * exams designed, questions authored, students reached, gradings sealed —
 * closing with the grade-reveal odometer and the Seal.
 *
 * Laws it honors:
 *  · Data only from services the panel already uses (no new endpoints, no
 *    cross-teacher anything). Everything on screen belongs to this teacher.
 *  · Persian digits everywhere a human reads a number (toPersianDigits /
 *    ScoreOdometer / toLocaleString('fa-IR')).
 *  · Motion: staggered one-shot reveals (viewport once) — pulse discipline.
 *    MotionConfig reducedMotion="user" parks the whole family.
 *  · The share card is drawn by hand on a canvas (no DOM serialization),
 *    brand colors and the girih decagram included, offered through
 *    navigator.share when the platform has it, download otherwise.
 *  · Tone: every line obeys docs/tone-of-voice.md — declaratives, no
 *    exclamation marks, Persian months, state + way out on errors.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Download, Share2 } from 'lucide-react';

import { Button } from '../../ui';
import { toPersianDigits } from '../../utils/persian';
import {
  computeWrappedStats,
  JALALI_MONTHS_FA,
  type WrappedStats,
} from '../../utils/wrappedStats';
import { ScoreOdometer } from '../../components/ScoreOdometer';
import {
  classService,
  examService,
  gradingService,
  questionService,
  studentService,
} from '../../services/api';

/** Jalali year label for the data being shown (from the earliest exam). */
function jalaliYearLabel(stats: WrappedStats): string {
  try {
    const ref = stats.earliestExamDate ? new Date(stats.earliestExamDate) : new Date();
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(ref);
  } catch {
    return '';
  }
}

/* ── the share card: hand-drawn, zero DOM serialization ─────────────────── */

function drawWrappedCard(canvas: HTMLCanvasElement, stats: WrappedStats, yearLabel: string): void {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Ink field — the dark plate.
  ctx.fillStyle = '#131220';
  ctx.fillRect(0, 0, W, H);

  // Girih decagram, hairline gold at 12% — the geometry behind the year.
  ctx.save();
  ctx.translate(W / 2, H / 2 + 40);
  ctx.strokeStyle = 'rgba(245, 179, 1, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    // {10/3} star polygon: jump 3 vertices per step on a 10-point ring
    const angle = ((i * 3) / 10) * Math.PI * 2 - Math.PI / 2;
    const r = 430;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // The Mark — four circles, third gold.
  const markY = 210;
  const d = 44;
  const gap = d * 1.4;
  const startX = W / 2 - (gap * 3) / 2;
  ctx.lineWidth = d * 0.22;
  ctx.strokeStyle = '#f5f6fa';
  for (let i = 0; i < 4; i++) {
    const cx = startX + gap * i;
    if (i === 2) {
      ctx.fillStyle = '#f5b301';
      ctx.beginPath();
      ctx.arc(cx, markY, d / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, markY, d / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5f6fa';
  ctx.font = '800 92px Vazirmatn, sans-serif';
  ctx.fillText('آزمون‌ساز', W / 2, 360);
  ctx.font = '700 56px Vazirmatn, sans-serif';
  ctx.fillStyle = '#f8c542';
  ctx.fillText(`روایت سال ${yearLabel}`, W / 2, 440);

  const line = (
    value: string,
    label: string,
    y: number,
    valueColor = '#f5f6fa',
  ) => {
    ctx.fillStyle = valueColor;
    ctx.font = '800 76px Vazirmatn, sans-serif';
    ctx.fillText(value, W / 2, y);
    ctx.fillStyle = '#a9a4bd';
    ctx.font = '700 36px Vazirmatn, sans-serif';
    ctx.fillText(label, W / 2, y + 52);
  };

  line(toPersianDigits(stats.examsDesigned), 'آزمون طراحی شد', 590);
  line(toPersianDigits(stats.questionsAuthored), 'سؤال در بانک', 740);
  line(toPersianDigits(stats.studentsCount), 'دانش‌آموز', 890);
  line(toPersianDigits(stats.submissionsGraded), 'ورقه مهر و موم شد', 1040, '#f8c542');

  if (stats.busiestMonth) {
    ctx.fillStyle = '#a9a4bd';
    ctx.font = '700 36px Vazirmatn, sans-serif';
    ctx.fillText(
      `شلوغ‌ترین ماه: ${JALALI_MONTHS_FA[stats.busiestMonth.month - 1]}`,
      W / 2,
      1170,
    );
  }

  ctx.fillStyle = '#6f6a7d';
  ctx.font = '700 30px Vazirmatn, sans-serif';
  ctx.fillText('آزمون‌ساز — هر آزمون، یک مهر', W / 2, 1270);
}

/* ── the page ────────────────────────────────────────────────────────────── */

export default function Wrapped() {
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [exams, students, questions, classGroups, submissions] = await Promise.all([
          examService.getExams(),
          studentService.getStudents(),
          questionService.getQuestions(),
          classService.getClassGroups(),
          gradingService.getSubmissions(),
        ]);
        if (!active) return;
        setStats(computeWrappedStats({ exams, students, questions, classGroups, submissions }));
      } catch {
        if (active)
          setError('آمار امسال بارگذاری نشد. اتصال را بررسی کنید و صفحه را دوباره باز کنید.');
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const yearLabel = useMemo(() => (stats ? jalaliYearLabel(stats) : ''), [stats]);

  const shareCard = async () => {
    const canvas = canvasRef.current ?? document.createElement('canvas');
    drawWrappedCard(canvas, stats!, yearLabel);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'azmoonsaz-wrapped.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'آزمون‌ساز Wrapped' });
        return;
      } catch {
        /* user cancelled — fall through to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'azmoonsaz-wrapped.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="lens rounded-3xl p-8 max-w-xl mx-auto text-center space-y-3">
        <h1 className="text-heading-2 text-[var(--color-text-primary)]">Wrapped</h1>
        <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="lens rounded-3xl p-8 max-w-xl mx-auto text-center">
        <p className="text-caption text-[var(--color-text-tertiary)]">
          در حال جمع‌کردن روایت سال…
        </p>
      </div>
    );
  }

  const stage = (children: ReactNode, key: number) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.33, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );

  const statCard = (value: string, label: string) => (
    <div className="pane rounded-2xl p-6 text-center space-y-1">
      <div className="text-heading-1 text-[var(--color-text-primary)] font-mono">{value}</div>
      <div className="text-label-muted">{label}</div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16" data-testid="wrapped-page">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {stage(
        <div className="lens rounded-3xl p-8 text-center space-y-3">
          <h1 className="text-display text-[var(--color-text-primary)]">
            روایت سال {yearLabel}
          </h1>
          <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">
            کاری که امسال با آزمون‌ساز ساخته‌اید، صفحه به صفحه.
          </p>
        </div>,
        0,
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stage(statCard(toPersianDigits(stats.examsDesigned), 'آزمون طراحی شد'), 1)}
        {stage(statCard(toPersianDigits(stats.questionsAuthored), 'سؤال در بانک'), 2)}
        {stage(statCard(toPersianDigits(stats.studentsCount), 'دانش‌آموز'), 3)}
        {stage(statCard(toPersianDigits(stats.classGroupsCount), 'کلاس'), 4)}
      </div>

      {stage(
        <div className="lens rounded-3xl p-8 text-center space-y-2">
          <p className="text-label-muted">ورقه‌هایی که امسال مهر و موم شد</p>
          <div className="text-display text-[var(--color-gold-ink)] font-mono">
            <ScoreOdometer value={stats.submissionsGraded} />
          </div>
          {stats.avgScorePct !== null && (
            <p className="text-caption text-[var(--color-text-secondary)]">
              میانگین نمره کلاس‌های شما: ٪{toPersianDigits(stats.avgScorePct)}
            </p>
          )}
        </div>,
        5,
      )}

      {(stats.biggestExam || stats.busiestMonth) && (
        <div className="grid md:grid-cols-2 gap-4">
          {stats.biggestExam &&
            stage(
              <div className="pane rounded-2xl p-6 text-center space-y-1">
                <div className="text-caption font-bold text-[var(--color-text-primary)] line-clamp-2">
                  {stats.biggestExam.title}
                </div>
                <div className="text-label-muted">
                  پرشمارترین آزمون — {toPersianDigits(stats.biggestExam.submissions)} ورقه
                </div>
              </div>,
              6,
            )}
          {stats.busiestMonth &&
            stage(
              <div className="pane rounded-2xl p-6 text-center space-y-1">
                <div className="text-caption font-bold text-[var(--color-text-primary)]">
                  {JALALI_MONTHS_FA[stats.busiestMonth.month - 1]}
                </div>
                <div className="text-label-muted">
                  شلوغ‌ترین ماه — {toPersianDigits(stats.busiestMonth.count)} تحویل
                </div>
              </div>,
              7,
            )}
        </div>
      )}

      {stage(
        <div className="lens rounded-3xl p-8 text-center space-y-4">
          <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">
            سال بعد هم، هر آزمون با همان مهر.
          </p>
          <div className="flex justify-center gap-3">
            <Button icon={<Share2 className="w-4 h-4" />} onClick={() => void shareCard()}>
              اشتراک کارت سال
            </Button>
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={() => void shareCard()}
            >
              ذخیره تصویر
            </Button>
          </div>
        </div>,
        8,
      )}
    </div>
  );
}
