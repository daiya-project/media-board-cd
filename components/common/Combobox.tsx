"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComboboxOption {
  id: string;
  name: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Label shown when nothing is selected */
  allLabel?: string;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** If false, hides the search input in the dropdown */
  searchable?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Searchable combobox with pill-style trigger.
 * Uses Popover + Command from shadcn/ui.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "검색...",
  allLabel = "전체",
  loading = false,
  disabled = false,
  searchable = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when popover opens
  useEffect(() => {
    if (open) {
      // Small delay to let the popover render
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [open]);

  // Filter options by search (case-insensitive, ignoring spaces)
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.replace(/\s/g, "").toLowerCase();
    return options.filter((o) => {
      const combined = `${o.id}${o.name}`.replace(/\s/g, "").toLowerCase();
      return combined.includes(q);
    });
  }, [options, search]);

  const selectedOption = value
    ? options.find((o) => o.id === value) ?? null
    : null;

  function handleSelect(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled || loading}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "inline-flex w-full items-center gap-1.5 rounded-full bg-white px-3 py-1.5",
            "border border-gray-200 text-[12px] text-gray-800",
            "shadow-sm backdrop-blur-sm",
            "outline-none transition-all",
            "hover:-translate-y-px hover:shadow-md hover:border-blue-300",
            "focus:border-blue-400 focus:ring-1 focus:ring-blue-400",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm",
            className,
          )}
        >
          {/* Display value or "allLabel" */}
          <span className="flex-1 truncate text-center">
            {loading
              ? "로딩 중..."
              : selectedOption
                ? selectedOption.name
                : allLabel}
          </span>

          {/* Clear button or chevron */}
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              className="shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(null);
                }
              }}
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown
              className={cn(
                "w-3 h-3 shrink-0 text-gray-400 transition-transform",
                open && "rotate-180",
              )}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="z-[80] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          {/* Search input */}
          {searchable && (
            <div className="flex items-center gap-2 border-b px-3 h-9">
              <Search className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-gray-400"
              />
            </div>
          )}

          <CommandList>
            <CommandEmpty className="py-4 text-center text-[12px] text-gray-500">
              검색 결과가 없습니다
            </CommandEmpty>

            <CommandGroup>
              {/* "All" fixed item at top */}
              <CommandItem
                value="__all__"
                onSelect={() => handleSelect(null)}
                className={cn(
                  "text-[12px] cursor-pointer justify-center",
                  !value && "font-medium text-blue-600",
                )}
              >
                {allLabel}
              </CommandItem>

              {filtered.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => handleSelect(opt.id)}
                  className={cn(
                    "text-[12px] cursor-pointer justify-center",
                    value === opt.id && "font-medium text-blue-600",
                  )}
                >
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
