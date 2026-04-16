/**
 * Server-side Supabase client scoped to the `media` schema.
 *
 * Centralises the `as any` cast required because `.schema()` is not
 * reflected in the generated Database types. All server-side API services
 * should import from here instead of casting individually.
 */

import { createClient } from "./server";

export async function createMediaClient() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).schema("media");
}
