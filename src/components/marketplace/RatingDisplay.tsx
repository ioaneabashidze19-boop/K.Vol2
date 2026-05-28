interface RatingDisplayProps {
  rating: number; // 0 to 5 decimal rating
  count?: number; // total review count
  size?: "sm" | "md";
}

export default function RatingDisplay({ rating, count, size = "sm" }: RatingDisplayProps) {
  const roundedRating = Math.round(rating * 2) / 2; // rounds to nearest 0.5
  const fullStars = Math.floor(roundedRating);
  const hasHalfStar = roundedRating % 1 !== 0;

  const starSizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";

  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`Rating: ${rating} out of 5 stars`}
    >
      <div className="flex items-center text-amber-400">
        {Array.from({ length: 5 }).map((_, idx) => {
          if (idx < fullStars) {
            // Full Star
            return (
              <svg
                key={idx}
                className={starSizeClass}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            );
          } else if (idx === fullStars && hasHalfStar) {
            // Half Star
            return (
              <svg
                key={idx}
                className={starSizeClass}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <defs>
                  <linearGradient id="halfGrad">
                    <stop
                      offset="50%"
                      stopColor="currentColor"
                    />
                    <stop
                      offset="50%"
                      stopColor="#475569"
                    />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#halfGrad)"
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>
            );
          } else {
            // Empty Star
            return (
              <svg
                key={idx}
                className={`${starSizeClass} text-slate-600`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            );
          }
        })}
      </div>

      {/* Review details */}
      <span className="text-xs font-bold text-text-secondary mt-0.5">
        {rating.toFixed(1)}
        {count !== undefined && <span className="text-text-muted font-medium ml-1">({count})</span>}
      </span>
    </div>
  );
}
