/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useResolvedImageUrl } from '../hooks/useResolvedImageUrl';
import { isLegacyImageValue, uploadQuestionImageFile } from '../services/imageStoreClient';
import { TextLink } from '../ui';

/**
 * Display-only image: storage keys resolve to short-lived signed URLs,
 * legacy data:/https: values pass through (grandfathered rows), empty
 * renders nothing. Never writes anything back — the persisted key stays
 * untouched in form state.
 */
export function ResolvedImage({
  value,
  alt,
  className,
  imgClassName,
}: {
  value: string | undefined | null;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const { src, loading } = useResolvedImageUrl(value);
  if (!value) return null;
  if (loading) {
    return (
      <div
        role="status"
        aria-label="در حال بارگذاری تصویر"
        className={`flex items-center justify-center bg-[var(--color-surface-secondary)] animate-pulse ${className ?? ''}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }
  if (!src) return null;
  return (
    <img
      loading="lazy"
      decoding="async"
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={imgClassName ?? className}
    />
  );
}

/** Badge shown under grandfathered (pre-pipeline) images. */
export function LegacyImageBadge() {
  return (
    <span className="text-micro text-[var(--color-warning)] font-bold">
      تصویر قدیمی — برای امنیت بیشتر دوباره بارگذاری کنید
    </span>
  );
}

function isLegacy(value: string | undefined | null): boolean {
  return isLegacyImageValue(value);
}

/**
 * Single upload control for question/option images: file picker → shrink →
 * direct PUT → onChange(storageKey). Shows signed preview for keys and
 * passthrough preview for legacy values.
 */
export function QuestionImageInput({
  value,
  onChange,
  notify,
}: {
  value: string | undefined | null;
  onChange: (next: string) => void;
  notify: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const { src, loading } = useResolvedImageUrl(value);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      notify('در حال فشرده‌سازی و بارگذاری تصویر…', 'info');
      const key = await uploadQuestionImageFile(file);
      onChange(key);
      notify('تصویر بارگذاری شد.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'بارگذاری تصویر ممکن نشد.', 'error');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="px-2 py-1 btn-glass btn-glass--quiet border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] rounded-md text-micro font-bold cursor-pointer shrink-0 inline-flex items-center gap-1">
        <ImagePlus className="w-3.5 h-3.5" />
        <span>{value ? 'تعویض تصویر' : 'الحاق تصویر'}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void pick(file);
          }}
        />
      </label>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-tertiary)]" />
      ) : src ? (
        <div className="flex items-center gap-1.5">
          <img
            loading="lazy"
            decoding="async"
            src={src}
            alt="پیش‌نمایش تصویر"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded object-cover border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)]"
          />
          {isLegacy(value) && <LegacyImageBadge />}
          <TextLink
            size="sm"
            tone="danger"
            bold
            onClick={() => onChange('')}
            className="inline-flex items-center gap-0.5"
          >
            <Trash2 className="w-3 h-3" />
            حذف
          </TextLink>
        </div>
      ) : (
        <span className="text-micro text-[var(--color-text-tertiary)] italic">عکسی نیست</span>
      )}
    </div>
  );
}
