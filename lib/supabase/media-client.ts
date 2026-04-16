/**
 * Browser-side Supabase client scoped to the `media` schema.
 *
 * Centralises the `as any` cast required because `.schema()` is not
 * reflected in the generated Database types. All browser-side API services
 * should import from here instead of casting individually.
 */

import { createClient } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMediaClient(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createClient() as any).schema("media");
}
