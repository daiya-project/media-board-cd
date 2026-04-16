import { Suspense } from "react";
import { HeaderActionButtons } from "./AppHeader/HeaderActionButtons";
import { HeaderFilters } from "./AppHeader/HeaderFilters";
import { LogoToggle } from "./AppHeader/LogoToggle";

/**
 * Global application header with logo toggle, filters, and action buttons.
 * Three-section layout: [logo toggle + title] | [filters] | [action buttons]
 */
export default function AppHeader() {
  return (
    <header className="bg-white border-b border-border px-4 h-16 flex items-center gap-4 shadow-sm z-30 flex-none">
      {/* Logo toggle (sidebar) + Title */}
      <div className="flex items-center gap-3 shrink-0">
        <LogoToggle />
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight leading-none">
            Media Board
          </h1>
          <span className="text-[10px] font-medium text-gray-400 tracking-wide uppercase">
            Partner Dashboard
          </span>
        </div>
      </div>

      {/* Filter controls — fills available space */}
      <div className="flex-1 min-w-0">
        <Suspense>
          <HeaderFilters />
        </Suspense>
      </div>

      {/* Action buttons — right-aligned */}
      <div className="flex items-center gap-2 shrink-0">
        <HeaderActionButtons />
      </div>
    </header>
  );
}
