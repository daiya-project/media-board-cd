/**
 * Redash 쿼리 11939 실행 공용 모듈 (수동 / 자동 공용).
 *
 * - 자동: lib/features/daily-redash-import/job.ts 가 매일 cron 에서 호출
 * - 수동: app/api/import/redash/route.ts 가 모달 호출을 중계
 *
 * REDASH_API_KEY 환경변수 필수 (server-only). 쿼리 결과가 캐시에 없으면
 * 2초 간격으로 최대 300회(10분) 폴링.
 *
 * Redash POST /api/queries/{id}/results 응답:
 *   - 캐시 hit: { query_result: {...} } → 즉시 반환
 *   - 새 실행:  { job: { id, status } } → polling
 */

import type { RedashRow } from "./adapter";

const REDASH_BASE_URL = "https://redash.dable.io";
const REDASH_QUERY_ID = 11939;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300; // 2초 × 300 = 10분

interface RedashJobResponse {
  job: {
    id: string;
    status: number; // 1=pending, 2=started, 3=success, 4=failure, 5=cancelled
    error?: string;
    query_result_id?: number;
  };
}

interface RedashResultResponse {
  query_result: {
    data: {
      rows: RedashRow[];
    };
  };
}

function redashHeaders(): HeadersInit {
  const apiKey = process.env.REDASH_API_KEY;
  if (!apiKey) {
    throw new Error("REDASH_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function pollJob(jobId: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${REDASH_BASE_URL}/api/jobs/${jobId}`, {
      headers: redashHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Job 상태 조회 실패: HTTP ${res.status}`);
    }

    const data = (await res.json()) as RedashJobResponse;
    const { status, error, query_result_id } = data.job;

    if (status === 3 && query_result_id) return query_result_id;
    if (status === 4) {
      throw new Error(`쿼리 실행 실패: ${error ?? "알 수 없는 오류"} (job=${jobId})`);
    }
    if (status === 5) {
      throw new Error(`쿼리 실행 취소됨 (job=${jobId})`);
    }
  }
  throw new Error(`쿼리 실행 시간 초과 (10분, job=${jobId})`);
}

async function fetchQueryResult(queryResultId: number): Promise<RedashRow[]> {
  const res = await fetch(
    `${REDASH_BASE_URL}/api/query_results/${queryResultId}`,
    { headers: redashHeaders() },
  );
  if (!res.ok) {
    throw new Error(`결과 조회 실패: HTTP ${res.status}`);
  }
  const data = (await res.json()) as RedashResultResponse;
  return data.query_result.data.rows;
}

export interface FetchOptions {
  startDate: string;       // YYYY-MM-DD inclusive
  endDate: string;         // YYYY-MM-DD inclusive
  clientIds: string[];     // ['5','10','14',...]
}

/**
 * Redash 쿼리 11939 를 지정 파라미터로 실행하고 행 배열 반환.
 *
 * 쿼리의 WHERE 절은 inclusive end 를 가정하지 않고 `< {{ date.end }}` 로 작성되어 있으므로
 * endDate 의 다음 날을 보내야 endDate 데이터가 포함된다 — 이 함수에서 보정한다.
 */
export async function fetchRedashRecords(
  opts: FetchOptions,
): Promise<RedashRow[]> {
  const { startDate, endDate, clientIds } = opts;

  if (clientIds.length === 0) {
    throw new Error("clientIds 가 비어 있습니다.");
  }

  // 쿼리의 WHERE: local_basic_time < {{ date.end }} → endDate 포함하려면 +1일 보정
  const dateEndExclusive = addOneDay(endDate);

  const executeRes = await fetch(
    `${REDASH_BASE_URL}/api/queries/${REDASH_QUERY_ID}/results`,
    {
      method: "POST",
      headers: redashHeaders(),
      body: JSON.stringify({
        parameters: {
          date: { start: startDate, end: dateEndExclusive },
          client_id: clientIds.join(","),
        },
        max_age: 0,
      }),
    },
  );

  if (!executeRes.ok) {
    if (executeRes.status === 401 || executeRes.status === 403) {
      throw new Error("Redash 인증 실패 — REDASH_API_KEY 확인");
    }
    throw new Error(`Redash 요청 실패: HTTP ${executeRes.status}`);
  }

  const executeData = (await executeRes.json()) as
    | RedashResultResponse
    | RedashJobResponse;

  if ("query_result" in executeData) {
    return executeData.query_result.data.rows;
  }
  if ("job" in executeData) {
    const queryResultId = await pollJob(executeData.job.id);
    return fetchQueryResult(queryResultId);
  }
  throw new Error("예상치 못한 Redash 응답 형식");
}

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}
