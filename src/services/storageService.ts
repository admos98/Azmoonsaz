/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabasePublicClient } from '../lib/supabasePublic';
import { publicEnv } from '../config/env';

export async function uploadQuestionImage(file: File): Promise<string> {
  if (!publicEnv.isSupabaseConfigured || publicEnv.enableMockMode) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  try {
    const supabase = getSupabasePublicClient();
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.warn('Supabase Storage upload failed, falling back to Base64 DataURI:', uploadError);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
    }

    const { data } = supabase.storage.from('question-images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.warn('Storage service encountered error, falling back to Base64:', err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}