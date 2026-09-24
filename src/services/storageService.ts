/** @license SPDX-License-Identifier: Apache-2.0 */

import { getSupabasePublicClient } from '../lib/supabasePublic';

export async function uploadTeacherAvatar(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم تصویر باید کمتر از ۵ مگابایت باشد.');
  const supabase = getSupabasePublicClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('نشست دبیر معتبر نیست.');
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userData.user.id}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('teacher-avatars').upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('teacher-avatars').getPublicUrl(path);
  return data.publicUrl;
}

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
