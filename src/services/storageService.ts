/** @license SPDX-License-Identifier: Apache-2.0 */

import { getSupabasePublicClient } from '../lib/supabasePublic';

export async function uploadQuestionImage(file: File): Promise<string> {
  const supabase = getSupabasePublicClient();
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('question-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('question-images').getPublicUrl(fileName);
  return data.publicUrl;
}
