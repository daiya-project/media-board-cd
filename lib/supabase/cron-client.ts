/**
 * Cookie-free Supabase 클라이언트.
 *
 * `lib/supabase/media-client.ts` 의 createMediaClient() 는 next/headers 의 cookies()
 * 를 의존하므로 request scope 외부 (cron, server-side cron-trigger route) 에서 호출 불가.
 *
 * 이 파일은 vanilla `@supabase/supabase-js` 의 createClient 로 cookie 의존성 없이
 * media schema 에 접근할 수 있는 클라이언트를 만든다.
 *
 * 권한: anon key 사용. RLS 정책이 unauthenticated insert/update 를 허용해야 함
 * (현재 모달이 브라우저에서 동작하므로 이 조건은 충족된 상태).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export function createCronSupabase(): SupabaseClient<Database, "media"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.",
    );
  }
  return createClient<Database, "media">(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "media" },
  });
}
