# Shared Utilities

## Document info
- **Created:** 2026-03-08 17:00:00
- **Last updated:** 2026-03-19 14:00:00

## Revision history
| Date | Description |
|------|-------------|
| 2026-03-08 17:00:00 | Initial version. |
| 2026-03-19 14:00:00 | blocknote-utils, csvParser, cvrCsvParser, contract-utils 추가 |

## Covered files
| Path | Role |
|------|------|
| `@/lib/utils.ts` | cn + formatNumberForDisplay 배럴 re-export |
| `@/lib/utils/cn.ts` | clsx + twMerge 합성 |
| `@/lib/utils/number-utils.ts` | 숫자/지표 포맷 |
| `@/lib/utils/date-utils.ts` | 날짜/요일 판별 |
| `@/lib/utils/sort-utils.ts` | 정렬 상태 + null-safe 비교 |
| `@/lib/utils/calculate-utils.ts` | CVR 레벨 계산 |
| `@/lib/utils/filters.ts` | 검색 매칭 + 소액 필터 |
| `@/lib/utils/table-display-utils.ts` | 테이블 스타일 상수 + 헬퍼 |
| `@/lib/utils/blocknote-utils.ts` | BlockNote 에디터 테마 + 텍스트 추출 |
| `@/lib/utils/csvParser.ts` | Daily CSV 파싱 (Google Sheets → media.daily) |
| `@/lib/utils/cvrCsvParser.ts` | CVR CSV 파싱 (Google Sheets → media.cvr) |
| `@/lib/utils/contract-utils.ts` | 계약 상태/값 포맷 + 뱃지 스타일 |
| `@/lib/api/rowMappers.ts` | Supabase → 앱 타입 매퍼 |
| `@/lib/config.ts` | 전역 상수 |

## 1. Overview

프로젝트 전역에서 사용하는 순수 유틸리티 모듈 모음. 모든 모듈은 서버/클라이언트 양쪽에서 사용 가능하며 외부 의존성이 없다 (cn.ts의 clsx/twMerge 제외).

## 2. Module Reference

### `@/lib/utils` (cn)

```typescript
cn(...inputs: ClassValue[]): string  // clsx + tailwind-merge
```

모든 컴포넌트의 className 합성에 사용. `@/lib/utils`에서 import.

---

### `@/lib/utils/number-utils`

| 함수 | 용도 | 반환 예시 |
|------|------|-----------|
| `formatMetricValue(value, metricType)` | 지표 셀 포맷 | `"1,234,567"`, `"45.2%"` |
| `formatChange(value, metricType)` | 증감 컬럼 포맷 | `"1,234"`, `"2.3%p"` |
| `formatComparison(value, metricType)` | 비교 컬럼 포맷 | `"+12.5%"` |
| `formatNumberForDisplay(value)` | 차트 툴팁 범용 | `"1,234"` |
| `isPercentType(metricType)` | 비율 지표 판별 | `true` (mfr, vrate, vctr) |
| `showChangeColumn(metricType)` | 증감 컬럼 표시 여부 | `false` (비율 지표) |

---

### `@/lib/utils/date-utils`

| 함수 | 용도 | 반환 예시 |
|------|------|-----------|
| `getDayType(dateStr, holidays)` | 요일 구분 (색상용) | `"weekday" \| "saturday" \| "sunday_or_holiday"` |
| `isWeekday(dateStr, holidays)` | 영업일 판별 | `true` / `false` |
| `isHolidayOrWeekend(dateStr, holidays)` | 휴일 판별 | `true` / `false` |
| `formatDateHeader(dateStr)` | 테이블 헤더 포맷 | `"03. 08."` |
| `toYearMonth(dateStr)` | 월 추출 | `"2026-03"` |

---

### `@/lib/utils/sort-utils`

| Export | 용도 |
|--------|------|
| `SortDirection` | `"asc" \| "desc" \| "none"` |
| `SortState<T>` | `{ field: T \| null; direction: SortDirection }` |
| `cycleSortDirection(prev, field)` | 컬럼 클릭 시 순환: none → asc → desc → none |
| `compareNullable(va, vb, multiplier, localeOptions?)` | null-last 비교 (숫자/문자 자동 판별) |

---

### `@/lib/utils/filters`

| 함수 | 용도 |
|------|------|
| `matchesSearch(fields, search)` | 쉼표 구분 검색어 매칭 (대소문자 무시) |
| `passesSmallAmountFilter(costSpent, filterType, excludeSmall)` | 소액 필터 (client: 100K, service: 30K, widget: 10K) |

---

### `@/lib/utils/table-display-utils`

| Export | 용도 |
|--------|------|
| `TABLE_THEAD_CLASS`, `TABLE_TH_CLASS`, `TABLE_TD_CLASS` | 테이블 기본 스타일 상수 |
| `getStickyColStyle(filterType, column, isHeader)` | 스티키 컬럼 inline style |
| `getDateHeaderColorClass(dayType)` | 헤더 요일 색상 (토=blue, 일/공휴=red) |
| `getDateCellColorClass(dayType, isZero)` | 셀 요일 색상 |
| `getTierBadgeClass(tier)` | 매중도 뱃지 색상 (상/중/하/기타) |
| `getStageBadgeClass(stage)` | 단계 뱃지 색상 |
| `getOwnerBadgeClass(managerId)` | 담당자 뱃지 색상 |

---

### `@/lib/utils/calculate-utils`

| 함수 | 용도 |
|------|------|
| `calcLevel(cmr, cvr)` | CVR 레벨 A-F 판정. CVR 임포트 시 사용 |

---

### `@/lib/utils/blocknote-utils`

| Export | 용도 |
|--------|------|
| `memoEditorTheme` | BlockNote 에디터 공용 테마 (MemoEditor, MemoViewModal 공유) |
| `extractPlainText(blocks)` | BlockNote JSONB → plain text 추출 (테이블 미리보기, 정렬용) |
| `extractHeadingPreview(blocks, maxLength?)` | 첫 번째 heading 추출 (테이블 셀 미리보기, 기본 60자) |

---

### `@/lib/utils/csvParser`

| 함수 | 용도 |
|------|------|
| `parseCSV(csvText)` | Google Sheets daily CSV → `ParsedCSVRow[]` 파싱. 한/영 헤더 지원 |
| `normalizeDate(dateStr)` | 다양한 날짜 형식 → `YYYY-MM-DD` 정규화 |

컬럼 매핑: `click` → `cnt_click`, `service_cv` → `cnt_cv`, ID 필드는 항상 `string`.

---

### `@/lib/utils/cvrCsvParser`

| 함수 | 용도 |
|------|------|
| `parseCvrCSV(csvText)` | Google Sheets CVR CSV → `CvrParsedRow[]` 파싱 |

16개 컬럼 매핑 (date, client_id, service_id, revenue, vimp, rpm, vctr_pct, cpc, click, campaign_count, normalized_cvr_pct, invalid_revenue_ratio_pct, contribution_margin_rate_pct 등). 보조지표(normalized_ctr_pct, server_fee_rate_pct 등)는 DB 저장 제외.

---

### `@/lib/utils/contract-utils`

| Export | 용도 |
|--------|------|
| `ContractStatus` | `"active" \| "expired" \| "future" \| "unknown"` 타입 |
| `getContractStatus(dateStart, dateEnd)` | 계약 상태 판별 (오늘 기준) |
| `SHARE_TYPE_STYLES` | 계약 타입별 뱃지 색상 (RS, CPM, MCPM, HYBRID, CPC) |
| `formatContractValue(type, value)` | 계약 값 포맷 (RS → `"60%"`, CPM → `"1,500원"`) |
| `formatContractPeriod(startDate, endDate)` | 계약 기간 포맷 (`"2024-01-01 ~ 2024-12-31"`) |

---

### `@/lib/api/rowMappers`

| 함수 | 매핑 대상 |
|------|-----------|
| `mapBaseMetrics(row)` | cost_spent, ad_revenue, imp, vimp, cnt_click → `number` (default 0) |
| `mapClientService(row)` | client_id/name, service_id/name → `string` |
| `mapWidget(row)` | widget_id/name → `string \| null` |

DB 경계에서 한 번만 호출. 이후 코드에서 재변환 불필요.

---

### `@/lib/config`

| 상수 | 값 | 용도 |
|------|---|------|
| `BATCH_SIZE` | 1000 | Supabase INSERT/SELECT 배치 |
| `CACHE_TTL` | 180000 (3분) | SWR 캐시 TTL |
| `SMALL_SLOT_THRESHOLD` | `{ client: 100K, service: 30K, widget: 10K }` | 소액 필터 기준 |
| `TREND_MIN_COST` | `{ adRevenue: 100K, vimp: 30K, mfr: 30K }` | Dashboard 트렌드 최소 비용 |
| `WIDGET_BATCH_SIZE` | 100 | 위젯 일괄 처리 |

## 3. AI Implementation Guide

### 새 유틸 함수 추가 시

1. 해당 도메인의 기존 파일에 추가 (숫자 → number-utils, 날짜 → date-utils)
2. 2곳 이상에서 사용될 때만 공용으로 추출
3. 순수 함수로 작성 (side effect 없음, 서버/클라이언트 양용)
4. JSDoc 필수

### 인라인 재구현 금지 패턴

```typescript
// ❌ 금지
const s = Number.isNaN(n) ? "—" : n.toLocaleString();

// ✅ 사용
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
```
