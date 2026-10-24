/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toPersianDigits } from '../../../utils/persian';
import type { Question, QuestionPart } from '../../../types';

type QuestionStaticSectionsProps = {
  q: Question;
  viewMode: 'teacher' | 'student';
};

export function QuestionStaticSections({ q, viewMode }: QuestionStaticSectionsProps) {
 return (
 <>
 {/* 6. Matching Pairs elements rendering */}
 {q.type === 'matching' && q.matchingPairs && (
 <div className="pane rounded-2xl p-4.5 mt-2 space-y-3.5 text-caption">
 <span className="block font-bold text-[var(--color-text-secondary)]">
 تطبیق ستون الف با ب:
 </span>
 <div className="space-y-2">
 {q.matchingPairs.map((pair, pIdx) => (
 <div
 key={pIdx}
 className="flex items-center justify-between gap-2.5 pane px-3 py-2 rounded-xl"
 >
 <span className="glx-inset text-[var(--color-text-secondary)] px-3 py-1.5 rounded-lg font-bold flex-1 text-center">
 {pair.right}
 </span>
 <span className="text-[var(--color-text-primary)] font-black">
 ➔
 </span>
 <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-soft)] px-3 py-1.5 rounded-lg font-bold flex-1 text-center">
 {pair.left}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 7. Ordering array rendering */}
 {q.type === 'ordering' && q.orderingItems && (
 <div className="pane rounded-2xl p-4.5 mt-2 text-caption">
 <span className="font-bold text-[var(--color-text-primary)] block mb-2.5">
 ترتیب قرارگیری مراحل صحیح:
 </span>
 <div className="flex flex-wrap gap-2 items-center">
 {q.orderingItems.map((item, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <span className="glx field border text-[var(--color-text-primary)] px-3.5 py-2 font-black rounded-xl">
 {toPersianDigits(idx + 1)}. {item}
 </span>
 {idx < (q.orderingItems?.length || 0) - 1 && (
 <span className="text-label-muted text-[var(--color-text-secondary)]">
 ➔
 </span>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 8. Reading Comprehension logic parts */}
 {q.type === 'reading_comprehension' && (
 <div className="space-y-4 mt-2">
 {q.parts && q.parts.length > 0 && (
 <div className="space-y-3" id="comprehension-parts">
 <span className="block font-bold text-[var(--color-text-secondary)] text-caption border-r-2 border-[var(--color-accent)]/100 pr-2 pb-0.5">
 زیرسوالات درک مطلب:
 </span>
 {q.parts.map((part: QuestionPart, idx: number) => {
 return (
 <div key={part.id} className="pane rounded-xl p-3.5 space-y-3">
 <h6 className="text-micro text-[var(--color-text-primary)] flex items-center gap-1.5">
 <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] w-5 h-5 rounded-full flex items-center justify-center text-micro">
 {toPersianDigits(idx + 1)}
 </span>
 <span>{part.text}</span>
 </h6>

 {/* Mini options in subquestions */}
 {part.options && part.options.length > 0 && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-micro mr-5">
 {part.options.map((opt) => {
 const isCorrect =
 opt.isCorrect || part.correctAnswer === opt.id;
 return (
 <div
 key={opt.id}
 className={`p-2 rounded-lg border ${
 viewMode === 'teacher' && isCorrect
 ? 'btn-glass btn-glass--success font-bold'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 <span>{opt.text}</span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* 9. Cloze Test inline blanks list */}
 {q.type === 'cloze' && (
 <div className="space-y-3 mt-2">
 {q.parts && q.parts.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {q.parts.map((p, pIdx) => (
 <div key={p.id} className="p-3 pane rounded-xl space-y-2">
 <strong className="text-[var(--color-accent)] text-micro block text-right">
 جای خالی کلوز شماره {toPersianDigits(pIdx + 1)}
 </strong>
 <div className="flex flex-wrap gap-1.5 text-micro">
 {p.options?.map((opt) => (
 <span
 key={opt.id}
 className={`px-2 py-0.5 rounded-md border text-center ${
 (opt.isCorrect || p.correctAnswer === opt.id) &&
 viewMode === 'teacher'
 ? 'btn-glass btn-glass--success font-bold font-mono'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 {opt.text}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </>
 );
}
