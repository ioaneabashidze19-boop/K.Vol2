interface ServiceBadgeProps {
  category: string;
}

export default function ServiceBadge({ category }: ServiceBadgeProps) {
  const cleanCategory = category.toLowerCase().trim();

  // Color mappings based on common categories
  const colorMap: Record<string, string> = {
    development: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    design: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    marketing: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    consulting: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    sales: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  };

  const selectedClass = colorMap[cleanCategory] || "bg-slate-800 text-slate-300 border-slate-700/50";

  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${selectedClass}`}
    >
      {category}
    </span>
  );
}
