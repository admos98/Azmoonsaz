/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Question pool views for the question bank: card grid, table rows, and the
 * empty filtered state, inside the shared AnimatePresence layout group.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx.
 */
import { motion, AnimatePresence } from 'motion/react';
import {
  Image as ImageIcon,
  Bookmark,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { DifficultyBadge, EmptyState, IconButton } from '../../ui';
import { AbsenceArt } from '../../components/AbsenceArt';
import { toPersianDigits } from '../../utils/persian';
import { getTypeNameInPersian } from '../../utils/question-type-labels';
import type { RichQuestion } from './types';

export function QuestionListViews({
  viewMode,
  filteredQuestions,
  visibleQuestions,
  previewTriggerRef,
  setPreviewQuestion,
  drawerTriggerRef,
  openEditDrawer,
  handleDeleteQuestion,
}: {
  viewMode: 'card' | 'table';
  filteredQuestions: RichQuestion[];
  visibleQuestions: RichQuestion[];
  previewTriggerRef: RefObject<HTMLElement | null>;
  setPreviewQuestion: Dispatch<SetStateAction<RichQuestion | null>>;
  drawerTriggerRef: RefObject<HTMLElement | null>;
  openEditDrawer: (q: RichQuestion) => void;
  handleDeleteQuestion: (id: string, name: string) => void;
}) {
  return (
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredQuestions.length > 0 ? (
            viewMode === 'card' ? (
              /* CARD GRID VIEW MODE */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5" id="questions-grid">
                {visibleQuestions.map((q) => {
                  const hasImage = !!q.imageUrl || q.options?.some((o) => o.imageUrl);
                  const subquestionsCount = q.parts?.length || 0;

                  return (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="lens rounded-3xl p-6 border hover:border-[var(--color-accent)]/20 transition-all flex flex-col justify-between gap-4 relative overflow-hidden"
                      id={`card-q-${q.id}`}
                    >
                      <div className="space-y-3.5">
                        {/* Upper line metadata */}
                        <div className="flex items-center justify-between gap-1 text-micro text-[var(--color-text-tertiary)]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="glx-inset text-[var(--color-text-secondary)] font-bold px-2 py-0.5 rounded-md">
                              پایه {q.grade}
                            </span>
                            <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-bold px-2 py-0.5 rounded-md">
                              {q.category}
                            </span>
                            {q.section && (
                              <span className="text-[var(--color-text-tertiary)] italic">
                                فصل: {q.section}
                              </span>
                            )}
                          </div>

                          {q.difficulty && <DifficultyBadge difficulty={q.difficulty} />}
                        </div>

                        {/* Title block */}
                        <div>
                          <p className="font-bold text-[var(--color-text-primary)] text-caption lines-1 flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                            <span>{q.title}</span>
                          </p>
                          <p className="text-micro text-[var(--color-text-tertiary)] leading-relaxed mt-1.5 line-clamp-2">
                            {q.text}
                          </p>
                        </div>

                        {/* Middle specific indicators badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--color-glass-light-stroke)]">
                          <span className="glx field text-[var(--color-text-secondary)] rounded-md px-2 py-0.5 text-micro font-semibold border border-[var(--color-glass-light-stroke)]/60">
                            {getTypeNameInPersian(q.type)}
                          </span>

                          <span className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 px-2.5 py-0.5 rounded-md text-micro">
                            نمره: {toPersianDigits(q.points)}
                          </span>

                          {subquestionsCount > 0 && (
                            <span className="bg-[var(--color-info-soft)]/30 text-[var(--color-info)] border border-[var(--color-info)]/20 px-2 py-0.5 rounded-md text-micro font-semibold">
                              {toPersianDigits(subquestionsCount)} مینی‌سوال تابعه
                            </span>
                          )}

                          {hasImage && (
                            <span className="bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] border border-[var(--color-accent)]/20 px-2 py-0.5 rounded-md text-micro flex items-center gap-1 font-semibold">
                              <ImageIcon className="w-3 h-3 text-[var(--color-accent)]" />
                              <span>تصویردار</span>
                            </span>
                          )}

                          {q.completenessStatus === 'incomplete' && (
                            <span className="bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border border-[var(--color-danger)]/10 px-2 py-0.5 rounded-md text-micro flex items-center gap-0.5">
                              <AlertCircle className="w-3" />
                              پیش‌نویس
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action footer operations */}
                      <div className="border-t pt-3.5 flex justify-between items-center pane -m-5 mt-2 px-5 py-3">
                        <div className="flex gap-1.5">
                          {q.tags?.slice(0, 2).map((tag, i) => (
                            <span
                              key={i}
                              className="text-micro text-[var(--color-accent)] glx field border px-1.5 py-0.5 rounded-md"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-1.5">
                          <IconButton
                            label="پیش‌نمایش زنده"
                            title="پیش‌نمایش زنده"
                            size="sm"
                            radius="lg"
                            tone="accent"
                            surface="bright"
                            onClick={(e) => {
                              previewTriggerRef.current = e.currentTarget;
                              setPreviewQuestion(q);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="ویرایش سوال"
                            title="ویرایش سوال"
                            size="sm"
                            radius="lg"
                            tone="secondary"
                            surface="bright"
                            onClick={(e) => {
                              drawerTriggerRef.current = e.currentTarget;
                              openEditDrawer(q);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="حذف سوال"
                            title="حذف سوال"
                            size="sm"
                            radius="lg"
                            tone="danger"
                            surface="wash"
                            onClick={() => handleDeleteQuestion(q.id, q.title)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* TABLE ROW VIEW MODE */
              <div
                className="lens rounded-3xl overflow-hidden"
                id="questions-table-view-box"
              >
                <div className="overflow-x-auto text-right">
                  <table
                    className="w-full text-caption text-[var(--color-text-secondary)]"
                    id="questions-table"
                  >
                    <thead className="border-b text-[var(--color-text-tertiary)]">
                      <tr>
                        <th className="p-4 font-bold text-right">خلاصه متن سوال</th>
                        <th className="p-4 font-bold text-right">پایه</th>
                        <th className="p-4 font-bold text-right">درس / فصل</th>
                        <th className="p-4 font-bold text-right">نوع قالب سوال</th>
                        <th className="p-4 font-bold text-center">سختی</th>
                        <th className="p-4 font-bold text-center">نمره (بارم)</th>
                        <th className="p-4 font-bold text-center">زیرسوال‌ها</th>
                        <th className="p-4 font-bold text-center">پیوست عکس</th>
                        <th className="p-4 font-bold text-center font-sans">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-glass-light-stroke)]">
                      {visibleQuestions.map((q) => {
                        const hasImage = !!q.imageUrl || q.options?.some((o) => o.imageUrl);
                        const subquestionsCount = q.parts?.length || 0;

                        return (
                          <motion.tr
                            key={q.id}
                            layout
                            className="hover:brightness-105 transition-colors"
                          >
                            {/* Short question text */}
                            <td className="p-4 max-w-xs md:max-w-sm">
                              <div>
                                <h5 className="font-bold text-[var(--color-text-primary)] line-clamp-1">
                                  {q.title}
                                </h5>
                                <p className="text-micro text-[var(--color-text-tertiary)] line-clamp-1 mt-0.5">
                                  {q.text}
                                </p>
                              </div>
                            </td>

                            {/* Grade */}
                            <td className="p-4 text-[var(--color-text-secondary)] font-medium">
                              پایه {q.grade}
                            </td>

                            {/* Subject & Section */}
                            <td className="p-4 text-[var(--color-text-secondary)]">
                              <span className="font-semibold block">{q.category}</span>
                              <span className="text-micro text-[var(--color-text-tertiary)] block mt-0.5">
                                {q.section || 'فصل کلی'}
                              </span>
                            </td>

                            {/* Grade Type */}
                            <td className="p-4">
                              <span className="text-[var(--color-accent)] font-semibold bg-[var(--color-accent-soft)] text-micro px-2 py-0.5 rounded-full border border-[var(--color-accent-soft)]">
                                {getTypeNameInPersian(q.type)}
                              </span>
                            </td>

                            {/* Difficulty */}
                            <td className="p-4 text-center">
                              {q.difficulty ? (
                                <DifficultyBadge difficulty={q.difficulty} />
                              ) : (
                                <span className="text-[var(--color-text-tertiary)]">—</span>
                              )}
                            </td>

                            {/* Score Gained */}
                            <td className="p-4 text-center text-[var(--color-warning)] font-mono text-micro">
                              {toPersianDigits(q.points)}
                            </td>

                            {/* Subquestions count */}
                            <td className="p-4 text-center">
                              <span
                                className={`font-semibold ${subquestionsCount > 0 ? 'text-[var(--color-info)]' : 'text-[var(--color-text-tertiary)]'}`}
                              >
                                {subquestionsCount > 0 ? toPersianDigits(subquestionsCount) : '—'}
                              </span>
                            </td>

                            {/* Has image? */}
                            <td className="p-4 text-center">
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${hasImage ? 'bg-[var(--color-accent-soft)]/40 border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 shadow-xs' : 'glx-inset'}`}
                                title={hasImage ? 'دارای تصویر ضمیمه' : 'فاقد تصویر'}
                              ></span>
                            </td>

                            {/* Row Actions */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <IconButton
                                  label="پیش‌نمایش"
                                  title="پیش‌نمایش"
                                  size="xs"
                                  radius="lg"
                                  tone="accent"
                                  surface="bright"
                                  motion={false}
                                  onClick={(e) => {
                                    previewTriggerRef.current = e.currentTarget;
                                    setPreviewQuestion(q);
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </IconButton>
                                <IconButton
                                  label="ویرایش"
                                  title="ویرایش"
                                  size="xs"
                                  tone="tertiary"
                                  surface="bright"
                                  motion={false}
                                  onClick={(e) => {
                                    drawerTriggerRef.current = e.currentTarget;
                                    openEditDrawer(q);
                                  }}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </IconButton>
                                <IconButton
                                  label="حذف"
                                  title="حذف"
                                  size="xs"
                                  radius="lg"
                                  tone="danger"
                                  surface="wash"
                                  motion={false}
                                  onClick={() => handleDeleteQuestion(q.id, q.title)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </IconButton>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* EMPTY FILTERED QUESTIONS STATE */
            <div id="empty-questions">
              {/* C.2 abs-4 — no filter match: the absence piece, not the
                  neutral parent motif (which means "bank is empty"). */}
              <EmptyState
                art={<AbsenceArt kind="no-results" size={160} />}
                title="هیچ سوالی با فیلترهای بالا همخوانی ندارد"
                description="می‌توانید فیلترهای جستجو، سطح سختی یا نوع سوالات را تغییر دهید یا نسبت به افزودن سوال جدید به مخزن اقدام کنید."
              />
            </div>
          )}
        </AnimatePresence>
  );
}
