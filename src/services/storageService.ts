/** @license SPDX-License-Identifier: Apache-2.0 */

import { getSupabasePublicClient } from '../lib/supabasePublic';

export async function uploadTeacherAvatar(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم تصویر باید کمتر از ۵ مگابایت باشد.');
  const supabase = getSupabasePublicClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('نشست دبیر معتبر نیست.');
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userData.user.id}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from('teacher-avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('teacher-avatars').getPublicUrl(path);
  return data.publicUrl;
}

// NOTE: question images no longer upload here. The single path is
// imageStoreClient.uploadQuestionImageFile → POST /api/teacher/images/upload-url
// (mint) → PUT bytes direct to the store → persist only the opaque storage key.
// This keeps bytes off Vercel and keeps provider swaps (Supabase ↔ Parspack S3)
// to a server-side env flip with identical keys.
