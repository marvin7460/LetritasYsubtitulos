export interface ProgressBarProps {
  /** 0–1, or null for an indeterminate bar. */
  value: number | null;
  label: string;
  className?: string;
}

export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(percent === null ? {} : { 'aria-valuenow': percent })}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      {percent === null ? (
        <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-brand" />
      ) : (
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}
