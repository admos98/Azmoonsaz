/**
 * Shared editor-payload shapes for the type-specific question builders.
 * These are the *page-local* form shapes before server normalization:
 * options always carry isCorrect, parts' correctAnswer is plain text
 * while editing.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from 'react';

export type FormOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
};

export type FormPart = {
  id: string;
  text: string;
  correctAnswer?: string;
  imageUrl?: string;
};

/** Image upload scope: the main image, an option row or a part row. */
export type ImageUploadScope = 'main' | { optIndex: number } | { partIndex: number };
export type ImageUploadEvent = ChangeEvent<HTMLInputElement>;
