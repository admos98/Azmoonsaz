/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudentAnswerValue =
  | string
  | boolean
  | string[]
  | Record<string, string | string[] | boolean>;

/**
 * Shared answer-value contract (renderer → save → restore → queue → grader).
 * Mirrors the server's discriminated schema in examSecurity.js:
 * - scalar string/boolean: choice ids, true/false, free text
 * - string[]: multiple_choice ids, ordering sequence, fill-blank rows
 * - Record<string, string | string[]>: matching { left: right }, cloze/reading
 *   parts { partId: scalar-or-array }
 * Anything outside these shapes is dropped by sanitizeStudentAnswer — the
 * "saved" indicator must never conceal a lost answer.
 */

export interface StudentQuestionBody {
  text?: string;
  imageUrl?: string;
  options?: { id: string; text: string; imageUrl?: string }[];
  parts?: {
    id: string;
    text: string;
    type: string;
    imageUrl?: string;
    options?: { id: string; text: string; imageUrl?: string }[];
  }[];
  displayPairs?: { left: string; right: string }[];
  displayItems?: string[];
  /** Non-secret field count for fill-blank (correctFillBlanks stays server-side). */
  blankCount?: number;
}

export interface StudentQuestion {
  id: string;
  type: string;
  title: string;
  body: StudentQuestionBody;
  points: number;
}
