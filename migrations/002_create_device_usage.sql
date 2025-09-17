-- Track free usage per device per month
CREATE TABLE IF NOT EXISTS device_usage (
  device_id TEXT PRIMARY KEY,
  current_month TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_usage_month ON device_usage(current_month);

