import type { ReactNode } from "react";

interface FormGroupProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export default function FormGroup({ children, columns = 2, className = "" }: FormGroupProps) {
  const columnGridMap = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
  };

  return (
    <div className={`grid gap-5 w-full ${columnGridMap[columns]} ${className}`}>
      {children}
    </div>
  );
}
