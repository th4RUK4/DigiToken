CREATE TABLE tokens (
  id BIGSERIAL PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('walkin', 'online')),
  service VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'serving', 'completed', 'no-show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_status_created_at ON tokens(status, created_at);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  token_id BIGINT REFERENCES tokens(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'browser',
  message VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
