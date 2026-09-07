CREATE TABLE invite_claims (
  claim_id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  claimed_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  FOREIGN KEY (invite_code) REFERENCES invite_codes(code)
);

CREATE INDEX idx_invite_claims_claimed_at
ON invite_claims(claimed_at DESC);

PRAGMA optimize;
