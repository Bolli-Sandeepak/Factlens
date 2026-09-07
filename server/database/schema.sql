-- FactLens SQLite Schema

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER DEFAULT 0,
    dataset_category TEXT,
    uploaded_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded',
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS document_pages (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    text_content TEXT,
    token_count INTEGER DEFAULT 0,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    value TEXT NOT NULL,
    normalized_value REAL,
    unit TEXT,
    period TEXT,
    scope TEXT,
    metric_qualifier TEXT,
    page INTEGER NOT NULL,
    evidence TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    extractor TEXT DEFAULT 'deterministic',
    raw_json TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    fact_a_id TEXT NOT NULL,
    fact_b_id TEXT NOT NULL,
    classification TEXT NOT NULL, -- 'CORROBORATED', 'CONTRADICTION', 'CONTEXTUAL_DIFFERENCE', 'UNCERTAIN'
    reasoning TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    context_diff_type TEXT, -- 'TEMPORAL', 'SCOPE', 'METRIC_DEFINITION', 'UNIT_ACCOUNTING', 'STATUS_ROLE', 'NONE'
    created_at TEXT NOT NULL,
    FOREIGN KEY (fact_a_id) REFERENCES facts(id) ON DELETE CASCADE,
    FOREIGN KEY (fact_b_id) REFERENCES facts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_pages_doc ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_facts_doc ON facts(document_id);
CREATE INDEX IF NOT EXISTS idx_facts_subject_pred ON facts(subject, predicate);
CREATE INDEX IF NOT EXISTS idx_facts_period ON facts(period);
CREATE INDEX IF NOT EXISTS idx_relationships_facts ON relationships(fact_a_id, fact_b_id);
CREATE INDEX IF NOT EXISTS idx_relationships_class ON relationships(classification);
