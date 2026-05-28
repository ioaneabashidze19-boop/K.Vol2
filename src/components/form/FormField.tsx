import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  id?: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
}

export default function FormField({ label, error, id, required = false, description, children }: FormFieldProps) {
  const descId = id ? `${id}-desc` : undefined;
  const errId = id ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-sm font-semibold text-text-secondary"
        >
          {label}
          {required && <span className="text-text-error ml-1">*</span>}
        </label>
      </div>

      {children}

      {/* Description */}
      {description && !error && (
        <p
          id={descId}
          className="text-xs text-text-muted leading-relaxed"
        >
          {description}
        </p>
      )}

      {/* Error validation banner */}
      {error && (
        <p
          id={errId}
          role="alert"
          className="text-xs font-medium text-text-error leading-relaxed"
        >
          {error}
        </p>
      )}
    </div>
  );
}
