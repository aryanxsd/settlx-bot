CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tracked_addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  chain TEXT,
  address TEXT,
  label TEXT,
  min_amount NUMERIC,
  is_active BOOLEAN DEFAULT true,
  last_seen_cursor TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alert_events (
  id SERIAL PRIMARY KEY,
  tracked_address_id INTEGER REFERENCES tracked_addresses(id),
  chain TEXT,
  tx_hash_or_sig TEXT,
  timestamp TIMESTAMP,
  direction TEXT,
  amount NUMERIC,
  asset TEXT,
  sent_to_telegram BOOLEAN DEFAULT false
);
