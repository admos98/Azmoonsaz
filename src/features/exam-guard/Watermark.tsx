/**
 * Wave A (exam hardening): attribution watermark.
 *
 * Does NOT block screenshots (browsers expose no API for that) — it stamps
 * the student's identity + exam code into every captured or photographed
 * frame so leaked material traces back to its source. Six percent opacity
 * keeps questions readable; pointer-events-none keeps clicks passing through.
 */
export function Watermark({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="exam-watermark"
      className="exam-watermark pointer-events-none fixed inset-0 z-40 overflow-hidden select-none"
      style={{ color: 'var(--color-text-primary)', opacity: 0.07 }}
    >
      <div className="absolute inset-[-30%] grid grid-cols-4 sm:grid-cols-6 gap-x-14 gap-y-12 content-start">
        {Array.from({ length: 96 }, (_, index) => (
          <span key={index} className="whitespace-nowrap text-[11px] font-black">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
