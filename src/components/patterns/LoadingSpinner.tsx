interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "pulse" | "dots";
  className?: string;
}

export default function LoadingSpinner({ size = "md", variant = "spinner", className = "" }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const selectedSize = sizeMap[size];

  if (variant === "pulse") {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        role="status"
        aria-label="Loading"
      >
        <span className={`${selectedSize} rounded-full bg-emerald-500 animate-ping opacity-75`} />
      </div>
    );
  }

  if (variant === "dots") {
    const dotSizes = {
      sm: "h-1.5 w-1.5",
      md: "h-2.5 w-2.5",
      lg: "h-3.5 w-3.5",
    };
    const dotSize = dotSizes[size];

    return (
      <div
        className={`flex items-center justify-center gap-1.5 ${className}`}
        role="status"
        aria-label="Loading"
      >
        <span className={`${dotSize} rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]`} />
        <span className={`${dotSize} rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]`} />
        <span className={`${dotSize} rounded-full bg-emerald-500 animate-bounce`} />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      {/* Circle ring */}
      <svg
        className={`animate-spin text-emerald-500 ${selectedSize}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-100"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
