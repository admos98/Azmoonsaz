/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Check, 
  X, 
  Image as ImageIcon, 
  HelpCircle, 
  Award, 
  Sparkles, 
  Info, 
  ArrowRight,
  ChevronRight,
  ListOrdered,
  Eye,
  FileText
} from 'lucide-react';
import { Question, QuestionType, QuestionOption, QuestionPart, RubricCriterion } from '../types';

interface QuestionRendererProps {
  question: Partial<Question> & {
    id: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    section?: string;
    explanation?: string;
    gradingGuide?: string;
    sampleAnswer?: string;
    correctAnswerText?: string;
  };
  showCorrectAnswers?: boolean; // Highlight correct options/keys for teacher preview
  onAnswerChange?: (questionId: string, answer: any) => void;
  currentAnswer?: any;
}

export default function QuestionRenderer({ 
  question, 
  showCorrectAnswers = true,
  onAnswerChange,
  currentAnswer 
}: QuestionRendererProps) {
  
  const toPersianDigits = (str: string | number | undefined): string => {
    if (str === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const getDifficultyLabel = (diff: string | undefined): string => {
    if (diff === 'easy') return 'آسان';
    if (diff === 'medium') return 'متوسط';
    if (diff === 'hard') return 'سخت';
    return 'متوسط';
  };

  const getDifficultyColor = (diff: string | undefined): string => {
    if (diff === 'easy') return 'bg-emerald-50 text-emerald-700 border-emerald-150';
    if (diff === 'hard') return 'bg-rose-50 text-rose-700 border-rose-150';
    return 'bg-amber-50 text-amber-700 border-amber-150';
  };

  const getTypeNameInPersian = (type: QuestionType | undefined): string => {
    if (!type) return '';
    const names: Record<QuestionType, string> = {
      single_choice: 'چهارگزینه‌ای تک‌پاسخ',
      multiple_choice: 'چندگزینه‌ای چندپاسخ',
      true_false: 'درست / نادرست',
      matching: 'وصل‌کردنی',
      ordering: 'مرتب‌سازی',
      fill_blank: 'جای خالی',
      short_answer: 'پاسخ کوتاه',
      long_answer: 'تشریحی',
      cloze: 'کلوز تست',
      reading_comprehension: 'درک مطلب',
      image_based: 'سوال تصویری',
    };
    return names[type] || 'طرح عمومی';
  };

  // Check if options have images to switch styles
  const optionsHaveImages = question.options?.some((o: any) => o.imageUrl);

  return (
    <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-150 shadow-xs space-y-5 text-right font-sans" dir="rtl" id={`render-q-${question.id}`}>
      
      {/* Header Specs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-50 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full font-bold">
            {getTypeNameInPersian(question.type)}
          </span>
          {question.grade && (
            <span className="bg-slate-100 text-slate-650 px-2 py-1 rounded-md">
              پایه {question.grade}
            </span>
          )}
          {question.category && (
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
              درس {question.category}
            </span>
          )}
          {question.section && (
            <span className="bg-indigo-50/50 text-slate-500 px-2 py-1 rounded-md">
              فصل: {question.section}
            </span>
          )}
          {question.difficulty && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getDifficultyColor(question.difficulty)}`}>
              {getDifficultyLabel(question.difficulty)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 bg-amber-50/70 border border-amber-200/50 text-slate-700 px-3 py-1 rounded-xl">
          <Award className="w-4 h-4 text-amber-500" />
          <span className="font-extrabold text-[12px]">{toPersianDigits(question.points)} نمره</span>
        </div>
      </div>

      {/* Main Question Text and Image Block */}
      <div className="space-y-4">
        <div className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
          {question.text}
        </div>
        
        {/* Main Image Banner If Available */}
        {question.imageUrl && (
          <div className="mt-2.5 relative group inline-block max-w-full">
            <img 
              src={question.imageUrl} 
              alt="ضمیمه سوال" 
              referrerPolicy="no-referrer"
              className="rounded-xl border border-slate-200 shadow-2xs max-h-64 object-contain max-w-full bg-slate-50"
            />
            <span className="absolute bottom-2 right-2 bg-slate-900/70 text-white rounded-md px-2 py-0.5 text-[9px] font-mono">
              پیوست اصلی تصویر سوال
            </span>
          </div>
        )}
      </div>

      {/* Render layouts according to question type */}

      {/* 1. Choice Questions: single_choice, multiple_choice, image_based */}
      {(question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'image_based') && question.options && (
        <div className={`mt-3 ${optionsHaveImages ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2'}`}>
          {question.options.map((opt: any, index: number) => {
            const letters = ['الف', 'ب', 'ج', 'د', 'هـ', 'و'];
            // Is this option correct according to definition?
            const isCorrect = opt.isCorrect || 
              (question.type === 'single_choice' && question.correctAnswer === opt.id) ||
              (question.type === 'image_based' && question.correctAnswer === opt.id) ||
              (question.type === 'multiple_choice' && Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id));
            
            return (
              <div 
                key={opt.id}
                className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                  showCorrectAnswers && isCorrect
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-medium shadow-2xs'
                    : 'bg-slate-50 border-slate-150 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                    showCorrectAnswers && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-800'
                  }`}>
                    {letters[index] || toPersianDigits(index + 1)}
                  </span>
                  
                  <div className="space-y-2.5 flex-1 text-right">
                    <span className="leading-relaxed">{opt.text}</span>
                    
                    {/* Option-specific Image attachment if exists */}
                    {opt.imageUrl && (
                      <div className="mt-2 block">
                        <img 
                          src={opt.imageUrl} 
                          alt={`تصویر گزینه ${letters[index] || index}`}
                          referrerPolicy="no-referrer"
                          className="rounded-lg border border-slate-200/80 max-h-32 object-contain w-full bg-white shadow-3xs" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {showCorrectAnswers && isCorrect && (
                  <div className="mr-8 mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    <span>گزینه پاسخ صحیح</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. True False */}
      {question.type === 'true_false' && (
        <div className="flex gap-4 mt-3">
          {[
            { label: 'درست / صحیح', val: true },
            { label: 'نادرست / غلط', val: false }
          ].map((item) => {
            const isSelected = question.correctAnswer === item.val;
            return (
              <div 
                key={String(item.val)}
                className={`flex-1 p-3.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 ${
                  showCorrectAnswers && isSelected
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-3xs'
                    : 'bg-slate-50 border-slate-150 text-slate-600'
                }`}
              >
                <span>{item.label}</span>
                {showCorrectAnswers && isSelected && (
                  <span className="bg-emerald-500 text-white p-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Fill Blank */}
      {question.type === 'fill_blank' && (
        <div className="space-y-3 mt-3">
          {showCorrectAnswers && question.correctFillBlanks && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900">
              <span className="block font-bold mb-2">کلید واژه‌های صحیح برای پر کردن جاهای خالی:</span>
              <div className="flex flex-wrap gap-2">
                {question.correctFillBlanks.map((ans, idx) => (
                  <span key={idx} className="bg-white border border-emerald-200 px-3 py-1.5 rounded-lg font-mono font-bold text-emerald-800">
                    جای خالی شماره {toPersianDigits(idx + 1)}: «{ans}»
                  </span>
                ))}
              </div>
            </div>
          )}
          {!showCorrectAnswers && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-150">
              <p className="text-slate-400 text-xs italic">هنرجو یا دانش‌آموز کلمات مناسب را در فیلد پاسخ تابعه تایپ می‌کند.</p>
            </div>
          )}
        </div>
      )}

      {/* 4. Short Answer */}
      {question.type === 'short_answer' && (
        <div className="space-y-3 mt-3">
          {showCorrectAnswers && question.correctAnswer && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900">
              <span className="block font-bold mb-1.5">پاسخ کوتاه مورد قبول:</span>
              <p className="font-mono bg-white px-3 py-2 border border-emerald-100 rounded-lg">{String(question.correctAnswer)}</p>
            </div>
          )}
          {question.explanation && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 text-slate-650 text-[11px] leading-relaxed">
              <span className="font-bold text-slate-800 block mb-1">توضیح دبیر / راهکار رسیدن به جواب:</span>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Long Answer / Descriptive (rubrics, manual corrections visual alert) */}
      {question.type === 'long_answer' && (
        <div className="space-y-3 mt-3">
          
          {/* Rubrics Criteria representation */}
          {question.rubrics && question.rubrics.length > 0 && (
            <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4 space-y-2 text-xs">
              <span className="block font-bold text-rose-800 mb-1.5">معیارهای تصحیح و توزیع بارم پاسخ تشریحی:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.rubrics.map((rub: RubricCriterion) => (
                  <div key={rub.id} className="p-3 bg-white border border-rose-200/60 rounded-xl">
                    <div className="flex justify-between items-center pb-1.5 border-b border-rose-50 mb-1.5">
                      <strong className="text-rose-950 font-bold">{rub.title}</strong>
                      <span className="bg-rose-100 text-rose-800 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold">{toPersianDigits(rub.maxPoints)} نمره</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{rub.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Answer */}
          {question.sampleAnswer && (
            <div className="bg-emerald-50/50 border border-emerald-150 rounded-xl p-4 text-xs text-emerald-900">
              <h5 className="font-bold mb-1.5">پاسخ نمونه / مدل استاندارد پاسخ تشریحی:</h5>
              <p className="bg-white p-3 rounded-lg border border-emerald-100 whitespace-pre-wrap leading-relaxed text-slate-700">{question.sampleAnswer}</p>
            </div>
          )}

          {/* Optional Teachers Grading Guide */}
          {question.gradingGuide && (
            <div className="bg-indigo-50/50 border border-indigo-150 rounded-xl p-4 text-xs text-slate-750">
              <span className="font-bold text-indigo-900 block mb-1">راهنمای تصحیح برای معلم:</span>
              <p>{question.gradingGuide}</p>
            </div>
          )}

          {/* STRICT REQUIREMENT FOR IN_UI ALERT */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">ملاحظه مهم تصحیح پاسخ‌برگ تشریحی:</p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                تصحیح سوالات تشریحی به صورت دستی انجام می‌شود. در آینده می‌توان پیشنهاد نمره با هوش مصنوعی اضافه کرد.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. Matching Pair lists */}
      {question.type === 'matching' && question.matchingPairs && (
        <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-150 mt-3 text-xs">
          <p className="font-bold text-slate-800 text-[11px] mb-2 border-b border-slate-200 pb-1.5">نگاشت وصل‌کردنی صحیح:</p>
          <div className="space-y-2">
            {question.matchingPairs.map((pair, pIdx) => (
              <div key={pIdx} className="flex gap-2.5 items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/70">
                <span className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-md font-bold text-center flex-1">{pair.right}</span>
                <span className="text-indigo-400 font-black">➔</span>
                <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-3 py-1.5 rounded-md font-bold text-center flex-1">{pair.left}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Ordering ordered elements listing */}
      {question.type === 'ordering' && question.orderingItems && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 mt-3 text-xs">
          <p className="font-bold text-indigo-950 mb-2.5">ترتیب قرارگیری پاسخ‌ها از راست به چپ:</p>
          <div className="flex flex-wrap gap-2 items-center">
            {question.orderingItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="bg-white border border-slate-250 text-slate-800 px-3.5 py-2 font-bold rounded-xl shadow-3xs">
                  {idx + 1}. {item}
                </span>
                {idx < (question.orderingItems?.length || 0) - 1 && (
                  <span className="text-slate-400 font-extrabold text-[12px]">➔</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Reading Comprehension (passage header, optional passage style image, and child subquestions parts list!) */}
      {question.type === 'reading_comprehension' && (
        <div className="space-y-4 mt-3">
          {/* Main Passage box */}
          <div className="bg-indigo-50/40 border border-indigo-150/70 rounded-2xl p-4.5 space-y-3" id="passage-container">
            <span className="bg-indigo-600 text-white rounded-lg px-2.5 py-0.5 text-[10px] font-bold inline-block">متن درک مطلب (Passage)</span>
            <p className="text-xs text-slate-800 leading-relaxed leading-[1.8] font-medium pre-wrap">{question.text}</p>
            
            {/* Optional Passage Photo support */}
            {question.imageUrl && (
              <div className="mt-2 text-right">
                <img 
                  src={question.imageUrl} 
                  alt="پیوست درک مطلب" 
                  referrerPolicy="no-referrer"
                  className="rounded-xl border border-slate-200 max-h-48 object-contain bg-white shadow-3xs" 
                />
              </div>
            )}
          </div>

          {/* Under subquestions parts listing! */}
          {question.parts && question.parts.length > 0 && (
            <div className="space-y-3 mt-4" id="comprehension-parts">
               <span className="block font-bold text-slate-800 text-xs border-r-2 border-indigo-500 pr-2">زیرسوالات درک مطلب:</span>
               
               {question.parts.map((part: QuestionPart, idx: number) => {
                 const partLetters = ['الف', 'ب', 'پ', 'ت', 'ث'];
                 return (
                   <div key={part.id} className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                     
                     {/* Subquestion prompt */}
                     <div className="flex items-start justify-between gap-2.5">
                       <h6 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                         <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold">
                           {partLetters[idx] || toPersianDigits(idx + 1)}
                         </span>
                         <span>{part.text}</span>
                       </h6>
                       {part.correctAnswer && showCorrectAnswers && (
                         <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-100">
                           کلید: {String(part.correctAnswer)}
                         </span>
                       )}
                     </div>

                     {/* Part options if any exists */}
                     {part.options && part.options.length > 0 && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mr-5">
                         {part.options.map((opt, oIdx) => {
                           const isCorrect = opt.isCorrect || part.correctAnswer === opt.id;
                           return (
                             <div 
                               key={opt.id}
                               className={`p-2.5 rounded-lg border ${
                                 showCorrectAnswers && isCorrect
                                   ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900 font-bold'
                                   : 'bg-white border-slate-150 text-slate-700'
                               }`}
                             >
                               {oIdx + 1}. {opt.text}
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

      {/* 9. Cloze Test with inline blank positions */}
      {question.type === 'cloze' && (
        <div className="space-y-4 mt-3">
          <div className="bg-teal-50/40 border border-teal-150/70 p-4.5 rounded-2xl text-xs text-slate-850 leading-loose leading-[1.8]" id="cloze-passage">
             <span className="bg-teal-600 text-white rounded-lg px-2 py-0.5 text-[9.5px] font-bold mb-3 inline-block">متن کلوز تست (Cloze Passage)</span>
             <p className="font-medium whitespace-pre-wrap">{question.text}</p>
          </div>

          {/* Mini parts option indicators per blank position */}
          {question.parts && question.parts.length > 0 && (
            <div className="space-y-3" id="cloze-blank-keys">
              <span className="block font-bold text-slate-800 text-xs border-r-2 border-teal-500 pr-2">پاسخ‌های گزینه‌ای نقاط خالی متن:</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.parts.map((p, pIdx) => {
                  return (
                    <div key={p.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                      <strong className="text-teal-900 font-bold text-[11px] block text-right">محل جای خالی شماره {toPersianDigits(pIdx + 1)}</strong>
                      <div className="flex flex-wrap gap-1.5 justify-content-start text-[11px]">
                        {p.options?.map((opt) => {
                          const isCorrect = opt.isCorrect || p.correctAnswer === opt.id;
                          return (
                            <span 
                              key={opt.id} 
                              className={`px-2.5 py-1 rounded-md border text-center ${
                                isCorrect && showCorrectAnswers
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold font-mono'
                                  : 'bg-white border-slate-200 text-slate-650'
                              }`}
                            >
                              {opt.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question Tags block at footer */}
      {question.tags && question.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px]">
          <span className="text-slate-400 font-medium">برچسب‌ها:</span>
          {question.tags.map((tag, idx) => (
            <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              #{tag}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
