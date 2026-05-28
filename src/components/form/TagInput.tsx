"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";

interface TagInputProps {
  tags: string[];
  placeholder?: string;
  onChange: (tags: string[]) => void;
  id?: string;
}

export default function TagInput({ tags, placeholder = "Add tag...", onChange, id }: TagInputProps) {
  const [inputVal, setInputVal] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = inputVal.trim().replace(/,$/, "");
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
        setInputVal("");
      }
    } else if (e.key === "Backspace" && !inputVal && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (idxToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== idxToRemove));
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Input container wrapper */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-lg p-2 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500 transition-colors">
        {/* Render badges */}
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 text-text-primary text-xs font-semibold px-2 py-1 rounded-md"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              aria-label={`Remove tag: ${tag}`}
              className="text-text-muted hover:text-text-error text-xs ml-0.5 focus:outline-none"
            >
              &times;
            </button>
          </span>
        ))}

        <input
          id={id}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-0 p-1 text-sm text-text-primary focus:outline-none placeholder:text-text-muted min-w-[80px]"
        />
      </div>
    </div>
  );
}
