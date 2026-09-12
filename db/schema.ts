export const schema = [
`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE, national_code TEXT, province TEXT, city TEXT, status TEXT NOT NULL, wallet_balance INTEGER NOT NULL DEFAULT 0, reserved_balance INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, service TEXT NOT NULL, status TEXT NOT NULL, amount INTEGER NOT NULL, files_count INTEGER NOT NULL DEFAULT 0, extracted_data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), project_id TEXT REFERENCES projects(id), service TEXT, type TEXT NOT NULL, status TEXT NOT NULL, amount INTEGER NOT NULL, payment_method TEXT, description TEXT, created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS wallet_ledger (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), transaction_id TEXT REFERENCES transactions(id), type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS pricing_plans (id TEXT PRIMARY KEY, name TEXT NOT NULL, service TEXT NOT NULL, pricing_enabled INTEGER NOT NULL DEFAULT 1, service_active INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL, billing_type TEXT NOT NULL, tiers TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`,
`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`,
`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
`CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id)`,
`CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON wallet_ledger(user_id)`,
`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)`
];
