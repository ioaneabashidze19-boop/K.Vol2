import Link from "next/link";

import PriceRange from "./PriceRange";
import RatingDisplay from "./RatingDisplay";
import ServiceBadge from "./ServiceBadge";

interface ProviderCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  reviewCount: number;
  minPrice: number;
  maxPrice?: number;
  techStack: string[];
}

export default function ProviderCard({
  id,
  name,
  description,
  category,
  rating,
  reviewCount,
  minPrice,
  maxPrice,
  techStack,
}: ProviderCardProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col gap-4 transition-all hover:border-slate-700/80 hover:translate-y-[-2px] duration-200">
      {/* Category and Rating */}
      <div className="flex items-center justify-between">
        <ServiceBadge category={category} />
        <RatingDisplay
          rating={rating}
          count={reviewCount}
        />
      </div>

      {/* Title & Description */}
      <div>
        <h3 className="text-lg font-bold font-display text-text-primary group-hover:text-emerald-400 transition-colors">
          {name}
        </h3>
        <p className="text-sm text-text-secondary line-clamp-2 mt-1 leading-normal">
          {description}
        </p>
      </div>

      {/* Tech stack badge array */}
      <div className="flex flex-wrap gap-1.5 mt-1">
        {techStack.slice(0, 4).map((tech, idx) => (
          <span
            key={idx}
            className="bg-slate-950 border border-slate-850 text-text-muted text-[10px] font-bold px-2 py-0.5 rounded"
          >
            {tech}
          </span>
        ))}
        {techStack.length > 4 && (
          <span className="text-[10px] font-bold text-text-muted px-1.5 py-0.5">
            +{techStack.length - 4} more
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-850/60 my-1" />

      {/* Price & Link */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div>
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
            Budget Scale
          </span>
          <PriceRange
            minPrice={minPrice}
            maxPrice={maxPrice}
          />
        </div>

        <Link
          href={`/marketplace/providers/${id}`}
          className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-text-primary text-xs font-semibold px-4 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}
