interface PriceRangeProps {
  minPrice: number;
  maxPrice?: number;
  currency?: string;
}

export default function PriceRange({ minPrice, maxPrice, currency = "USD" }: PriceRangeProps) {
  const formatValue = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex items-center gap-1 font-technical text-sm font-semibold text-text-accent">
      <span>{formatValue(minPrice)}</span>
      {maxPrice && (
        <>
          <span className="text-text-muted font-normal">-</span>
          <span>{formatValue(maxPrice)}</span>
        </>
      )}
    </div>
  );
}
