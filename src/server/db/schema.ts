export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  password_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_configs (
  provider TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  base_url TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  tags_json TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  last_check_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TEXT,
  last_check_error TEXT,
  last_used_at TEXT,
  last_error TEXT,
  last_status_code INTEGER,
  quota_json TEXT NOT NULL DEFAULT '{}',
  quota_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, fingerprint)
);

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  target_url TEXT,
  strategy TEXT,
  final_provider TEXT,
  final_key_fingerprint TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_summary TEXT,
  input_json TEXT,
  result_preview TEXT,
  messages_json TEXT,
  provider_order_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS request_attempt_logs (
  id TEXT PRIMARY KEY,
  request_log_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  key_fingerprint TEXT,
  attempt_no INTEGER NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER NOT NULL,
  error_summary TEXT,
  error_type TEXT,
  provider_base_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_log_id) REFERENCES request_logs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_async_jobs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  upstream_job_id TEXT NOT NULL,
  provider_key_id TEXT NOT NULL,
  provider_key_fingerprint TEXT NOT NULL,
  request_log_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, upstream_job_id)
);

CREATE TABLE IF NOT EXISTS search_sessions (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  sources_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS request_logs_fts USING fts5(
  request_id UNINDEXED,
  tool_name,
  target_url,
  final_provider,
  error_summary,
  result_preview
);

CREATE TABLE IF NOT EXISTS planning_sessions (
  id TEXT PRIMARY KEY,
  complexity_level INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planning_phase_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase_name TEXT NOT NULL,
  thought TEXT NOT NULL,
  data_json TEXT,
  confidence REAL NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, phase_name),
  FOREIGN KEY(session_id) REFERENCES planning_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
  ON request_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_request_logs_status_created_at
  ON request_logs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_request_logs_tool_name_created_at
  ON request_logs(tool_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_final_provider_created_at
  ON request_logs(final_provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_duration_ms_created_at
  ON request_logs(duration_ms, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_attempt_logs_created_at
  ON request_attempt_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_request_attempt_logs_request_log_id_attempt_no_created_at
  ON request_attempt_logs(request_log_id, attempt_no, created_at);

CREATE INDEX IF NOT EXISTS idx_request_attempt_logs_provider_created_at
  ON request_attempt_logs(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_attempt_logs_error_type_created_at
  ON request_attempt_logs(error_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_attempt_logs_request_log_id_status_attempt_no
  ON request_attempt_logs(request_log_id, status, attempt_no);

CREATE INDEX IF NOT EXISTS idx_provider_async_jobs_provider_upstream_job_id
  ON provider_async_jobs(provider, upstream_job_id);

CREATE INDEX IF NOT EXISTS idx_provider_async_jobs_provider_key_id
  ON provider_async_jobs(provider_key_id);

CREATE INDEX IF NOT EXISTS idx_provider_async_jobs_updated_at
  ON provider_async_jobs(updated_at);

CREATE INDEX IF NOT EXISTS idx_provider_keys_provider_enabled_created_at
  ON provider_keys(provider, enabled, created_at);

CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at
  ON search_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_planning_sessions_updated_at
  ON planning_sessions(updated_at);

CREATE TRIGGER IF NOT EXISTS request_logs_ai
AFTER INSERT ON request_logs
BEGIN
  INSERT INTO request_logs_fts(
    request_id,
    tool_name,
    target_url,
    final_provider,
    error_summary,
    result_preview
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.tool_name, ''),
    COALESCE(NEW.target_url, ''),
    COALESCE(NEW.final_provider, ''),
    COALESCE(NEW.error_summary, ''),
    COALESCE(NEW.result_preview, '')
  );
END;

CREATE TRIGGER IF NOT EXISTS request_logs_ad
AFTER DELETE ON request_logs
BEGIN
  DELETE FROM request_logs_fts WHERE request_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS request_logs_au
AFTER UPDATE ON request_logs
BEGIN
  DELETE FROM request_logs_fts WHERE request_id = OLD.id;
  INSERT INTO request_logs_fts(
    request_id,
    tool_name,
    target_url,
    final_provider,
    error_summary,
    result_preview
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.tool_name, ''),
    COALESCE(NEW.target_url, ''),
    COALESCE(NEW.final_provider, ''),
    COALESCE(NEW.error_summary, ''),
    COALESCE(NEW.result_preview, '')
  );
END;
`;
