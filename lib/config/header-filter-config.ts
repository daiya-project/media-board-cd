/**
 * Per-route configuration for header filters and action buttons.
 *
 * Each route entry declares which filter controls are visible/active
 * and which action buttons are enabled.
 * `getHeaderConfig()` resolves the config for the current pathname.
 */

export interface HeaderConfig {
  /** Show and enable the text search input */
  search: boolean;
  /** Show and enable the tier (매중도) combobox */
  tier: boolean;
  /** Show and enable the owner (담당자) combobox */
  owner: boolean;
  /** Show and enable the stage combobox */
  stage: boolean;
  /** Show and enable the follow-up toggle button */
  followup: boolean;
  /** Show and enable the reset-all-filters button */
  reset: boolean;
  /** Show and enable the "등록" (new pipeline) button */
  registerButton: boolean;
  /** Show and enable the "세일즈" (record action) button */
  salesButton: boolean;
}

const ROUTE_CONFIG: Record<string, HeaderConfig> = {
  "/dashboard": {
    search: true,
    tier: true,
    owner: true,
    stage: false,
    followup: false,
    reset: true,
    registerButton: false,
    salesButton: false,
  },
  "/management": {
    search: true,
    tier: true,
    owner: true,
    stage: true,
    followup: true,
    reset: true,
    registerButton: true,
    salesButton: true,
  },
  "/data-board": {
    search: true,
    tier: true,
    owner: true,
    stage: false,
    followup: false,
    reset: true,
    registerButton: false,
    salesButton: false,
  },
  "/cvr": {
    search: true,
    tier: true,
    owner: true,
    stage: false,
    followup: false,
    reset: true,
    registerButton: false,
    salesButton: false,
  },
};

const DEFAULT_CONFIG: HeaderConfig = ROUTE_CONFIG["/dashboard"];

/**
 * Returns the header config for the given pathname.
 * Falls back to the dashboard config for unknown routes.
 */
export function getHeaderConfig(pathname: string): HeaderConfig {
  const match = Object.keys(ROUTE_CONFIG).find((route) =>
    pathname.startsWith(route),
  );
  return match ? ROUTE_CONFIG[match] : DEFAULT_CONFIG;
}
