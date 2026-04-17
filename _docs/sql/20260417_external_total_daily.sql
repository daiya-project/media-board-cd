-- media.external_total_daily
-- FC 리포트용 일자별 캐시. fc-metrics-sync cron 이 매일 07:30 KST 에 upsert.
-- widget × date 단위 ExternalFcAutoInputs 스냅샷.

CREATE TABLE IF NOT EXISTS media.external_total_daily (
  widget_id         text      NOT NULL,
  date              date      NOT NULL,
  requests          integer,
  passback_imp      integer,
  vendor_imp        integer,
  dable_media_cost  numeric,
  dable_revenue     numeric,
  pb_media_cost     numeric,
  pb_revenue        numeric,
  rpm_dashboard     numeric,
  vendor_source     text,
  fetched_at        timestamp with time zone DEFAULT now(),
  PRIMARY KEY (widget_id, date)
);

CREATE INDEX IF NOT EXISTS external_total_daily_date_idx
  ON media.external_total_daily (date DESC);
