CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  vip_expire_time DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  max_uses INTEGER NOT NULL CHECK (max_uses = -1 OR max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  last_claim_token TEXT
);

CREATE TABLE IF NOT EXISTS user_invites (
  user_id INTEGER NOT NULL,
  invite_code TEXT NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, invite_code),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (invite_code) REFERENCES invite_codes(code)
);

CREATE TABLE IF NOT EXISTS invite_claims (
  claim_id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  claimed_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  FOREIGN KEY (invite_code) REFERENCES invite_codes(code)
);

CREATE INDEX IF NOT EXISTS idx_invite_claims_claimed_at
ON invite_claims(claimed_at DESC);
