import type { LucideIcon } from 'lucide-react';

export interface PreferenceOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface PreferenceSelectorProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<PreferenceOption<T>>;
  onChange: (value: T) => void;
}

export default function PreferenceSelector<T extends string>({
  label,
  value,
  options,
  onChange,
}: PreferenceSelectorProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {options.map((option, index) => {
        const Icon = option.icon;
        const selected = value === option.value;
        const selectAt = (nextIndex: number, currentButton: HTMLButtonElement) => {
          const normalizedIndex = (nextIndex + options.length) % options.length;
          onChange(options[normalizedIndex].value);
          const buttons =
            currentButton.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
          buttons?.[normalizedIndex]?.focus();
        };
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                event.preventDefault();
                selectAt(index + 1, event.currentTarget);
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                event.preventDefault();
                selectAt(index - 1, event.currentTarget);
              } else if (event.key === 'Home') {
                event.preventDefault();
                selectAt(0, event.currentTarget);
              } else if (event.key === 'End') {
                event.preventDefault();
                selectAt(options.length - 1, event.currentTarget);
              }
            }}
            className={`min-h-16 rounded-2xl border p-3 text-right transition-colors ${
              selected
                ? 'border-[var(--color-gold)] bg-[var(--color-gold-soft)]'
                : 'border-[var(--color-glass-light-stroke)] bg-[var(--color-glass-light-fill)] hover:bg-[var(--color-surface-secondary)]'
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  selected
                    ? 'bg-[var(--color-gold)] text-[var(--color-ink-field)]'
                    : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-caption font-bold text-[var(--color-text-primary)]">
                  {option.label}
                </span>
                <span className="block text-micro text-[var(--color-text-tertiary)]">
                  {option.description}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
