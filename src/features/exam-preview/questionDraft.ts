/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const createDraftQuestionId = (prefix: 'q-rep' | 'q-man') => `${prefix}-${crypto.randomUUID()}`;
