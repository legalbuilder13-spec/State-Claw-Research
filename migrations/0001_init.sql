-- ============================================================================
-- 0001_init.sql — Agentic-Law-OS initial Postgres schema
--
-- Establishes the 11 tables, pgvector indexes, tsvector full-text indexes,
-- hash-chain integrity trigger, and idempotent-upsert constraints the
-- agent runtime depends on.
--
-- Required extensions: vector (pgvector v0.7+), pgcrypto, pg_trgm.
-- Embedding dimension: 1024 (Voyage voyage-law-2).
-- All timestamps are timestamptz (Postgres rejects naive timestamps).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- Common types / functions
-- ----------------------------------------------------------------------------

-- Standard updated_at trigger function — applied per table where mutation is allowed.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CORPUS TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- statute_chunks — ingested statute corpus
--
-- One row per chunk (a contiguous span of statute text small enough to embed).
-- A full section may span multiple chunks; chunk_index/chunk_total preserve
-- ordering. char_start/char_end are offsets within the full section text
-- (used by R4 anchors via spanAnchor).
-- ----------------------------------------------------------------------------

CREATE TABLE statute_chunks (
  id                 text PRIMARY KEY,                -- ULID
  doc_id             text NOT NULL,                   -- '<src_cat>:<juris>:<identifier>'
  jurisdiction       text NOT NULL,                   -- 'US-CA', 'US-IL:lake-county', etc.
  source_category    text NOT NULL DEFAULT 'primary_statute',
  source_id          text NOT NULL,                   -- e.g. 'local_corpus_state_official'
  source_url         text,                            -- canonical URL on the official site

  -- Statutory address
  code               text NOT NULL,                   -- 'Lab.', 'Bus. & Prof.', etc.
  chapter_id         text,                            -- 'Division 3 Part 1 Chapter 2'
  section            text NOT NULL,                   -- '2775'
  subdivision        text,                            -- '(b)(1)(A)' or NULL

  -- Structural flags
  is_definitions_section boolean NOT NULL DEFAULT false,
  is_exemption_section   boolean NOT NULL DEFAULT false,
  is_operative_section   boolean NOT NULL DEFAULT true,

  -- Chunking
  chunk_index        int NOT NULL DEFAULT 0,
  chunk_total        int NOT NULL DEFAULT 1,
  char_start         int NOT NULL DEFAULT 0,
  char_end           int NOT NULL,

  -- Content
  text               text NOT NULL,
  text_normalized    text NOT NULL,                   -- post-normalize for R5 substring match
  hash               bytea NOT NULL,                  -- sha256 of text (32 bytes)

  -- Currency
  current_through    date NOT NULL,
  retrieved_at       timestamptz NOT NULL DEFAULT now(),
  amendment_history  jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Search
  embedding          vector(1024),                    -- voyage-law-2 (1024 dim)
  search_tsv         tsvector,

  -- Audit
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT statute_chunks_uniq UNIQUE (jurisdiction, doc_id, hash, chunk_index)
);

CREATE TRIGGER statute_chunks_set_updated BEFORE UPDATE ON statute_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- HNSW for cosine similarity over voyage-law-2 embeddings
CREATE INDEX statute_chunks_embedding_hnsw
  ON statute_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search
CREATE INDEX statute_chunks_search_tsv_gin
  ON statute_chunks USING gin (search_tsv);

-- Trigram fallback for fuzzy keyword matching
CREATE INDEX statute_chunks_text_trgm
  ON statute_chunks USING gin (text gin_trgm_ops);

-- Lookup by address
CREATE INDEX statute_chunks_addr_idx
  ON statute_chunks (jurisdiction, code, section, subdivision);

-- Lookup by doc_id (most common path)
CREATE INDEX statute_chunks_doc_id_idx
  ON statute_chunks (doc_id);

-- Lookup by chapter for R9 (Definitions section retrieval)
CREATE INDEX statute_chunks_chapter_idx
  ON statute_chunks (jurisdiction, chapter_id)
  WHERE chapter_id IS NOT NULL;

-- Definitions-section quick filter for R9
CREATE INDEX statute_chunks_definitions_idx
  ON statute_chunks (jurisdiction, chapter_id, section)
  WHERE is_definitions_section = true;

-- ----------------------------------------------------------------------------
-- regulation_chunks — ingested administrative-code corpus
--
-- Mirrors statute_chunks; structural fields use regulation terms.
-- ----------------------------------------------------------------------------

CREATE TABLE regulation_chunks (
  id                 text PRIMARY KEY,
  doc_id             text NOT NULL,
  jurisdiction       text NOT NULL,
  source_category    text NOT NULL DEFAULT 'primary_regulation',
  source_id          text NOT NULL,
  source_url         text,

  -- Regulatory address
  title              text NOT NULL,                   -- e.g. '29' for 29 CFR; '8' for CCR tit. 8
  part               text NOT NULL,
  section            text NOT NULL,
  subdivision        text,
  agency             text NOT NULL,                   -- 'Labor Commissioner', 'DOL', etc.
  implements_statute_doc_id text,                     -- back-reference to the delegating statute

  is_definitions_section boolean NOT NULL DEFAULT false,
  is_operative_section   boolean NOT NULL DEFAULT true,

  chunk_index        int NOT NULL DEFAULT 0,
  chunk_total        int NOT NULL DEFAULT 1,
  char_start         int NOT NULL DEFAULT 0,
  char_end           int NOT NULL,

  text               text NOT NULL,
  text_normalized    text NOT NULL,
  hash               bytea NOT NULL,

  current_through    date NOT NULL,
  retrieved_at       timestamptz NOT NULL DEFAULT now(),

  embedding          vector(1024),
  search_tsv         tsvector,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT regulation_chunks_uniq UNIQUE (jurisdiction, doc_id, hash, chunk_index)
);

CREATE TRIGGER regulation_chunks_set_updated BEFORE UPDATE ON regulation_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX regulation_chunks_embedding_hnsw
  ON regulation_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX regulation_chunks_search_tsv_gin
  ON regulation_chunks USING gin (search_tsv);
CREATE INDEX regulation_chunks_text_trgm
  ON regulation_chunks USING gin (text gin_trgm_ops);
CREATE INDEX regulation_chunks_addr_idx
  ON regulation_chunks (jurisdiction, title, part, section, subdivision);
CREATE INDEX regulation_chunks_doc_id_idx
  ON regulation_chunks (doc_id);
CREATE INDEX regulation_chunks_implements_idx
  ON regulation_chunks (implements_statute_doc_id)
  WHERE implements_statute_doc_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- case_index — CourtListener / CAP / Lexis-Doc-Get mirror with treatment flags
-- ----------------------------------------------------------------------------

CREATE TABLE case_index (
  id                 text PRIMARY KEY,
  doc_id             text NOT NULL,
  jurisdiction       text NOT NULL,
  source_category    text NOT NULL DEFAULT 'case_law',

  -- Case identity
  name               text NOT NULL,
  reporter           text NOT NULL,
  volume             text NOT NULL,
  first_page         text NOT NULL,
  pinpoint_pages     jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{page, char_start, char_end}]
  court              text NOT NULL,
  year               int NOT NULL,
  decided_at         date,

  -- Holdings + summaries
  holding_summary    text,
  syllabus_text      text,
  full_text          text,                            -- optional; some sources don't provide
  full_text_hash     bytea,

  -- Source links
  source_url         text,
  courtlistener_id   text,
  cap_id             text,
  lexis_id           text,

  -- Treatment (from citator)
  treatment_status   text NOT NULL DEFAULT 'unchecked',  -- good_law | negative_treatment | overruled | abrogated | depublished | superseded | mixed | unchecked
  citator_results    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- per-source results
  treatment_checked_at timestamptz,

  -- Currency
  current_through    date,
  retrieved_at       timestamptz NOT NULL DEFAULT now(),

  embedding          vector(1024),
  search_tsv         tsvector,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT case_index_uniq UNIQUE (jurisdiction, reporter, volume, first_page)
);

CREATE TRIGGER case_index_set_updated BEFORE UPDATE ON case_index
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX case_index_embedding_hnsw
  ON case_index USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
CREATE INDEX case_index_search_tsv_gin
  ON case_index USING gin (search_tsv);
CREATE INDEX case_index_name_trgm
  ON case_index USING gin (name gin_trgm_ops);
CREATE INDEX case_index_doc_id_idx
  ON case_index (doc_id);
CREATE INDEX case_index_treatment_idx
  ON case_index (treatment_status)
  WHERE treatment_status <> 'good_law';

-- ----------------------------------------------------------------------------
-- corpus_freshness — per-jurisdiction × source-kind ingestion metadata
--
-- Driven by R10 CurrencyTag and the W1 PartialAcrossStates coverage matrix.
-- ----------------------------------------------------------------------------

CREATE TABLE corpus_freshness (
  jurisdiction       text NOT NULL,
  source_kind        text NOT NULL,   -- 'primary_statute' | 'primary_regulation' | 'case_law' | ...
  current_through    date NOT NULL,
  last_ingested_at   timestamptz NOT NULL,
  ingestion_run_id   text,
  chunk_count        int NOT NULL DEFAULT 0,
  error_message      text,
  notes              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (jurisdiction, source_kind)
);

CREATE TRIGGER corpus_freshness_set_updated BEFORE UPDATE ON corpus_freshness
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- RUN-STATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- task_specs — frozen TaskSpec per orchestration run
-- ----------------------------------------------------------------------------

CREATE TABLE task_specs (
  id                  text PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  frozen_at           timestamptz,
  requester           jsonb NOT NULL,
  verbatim_question   text NOT NULL,
  jurisdictions       text[] NOT NULL,
  topic               text NOT NULL,
  source_profile      text NOT NULL,
  company_context_ref jsonb NOT NULL,
  output_type         text NOT NULL,
  requires_fresh      boolean NOT NULL DEFAULT false,
  priority            text NOT NULL DEFAULT 'medium',
  deadline            timestamptz,
  pre_flight_notes    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Operator scope for v6+ RLS
  matter_id           text,

  CHECK (source_profile IN ('A','B')),
  CHECK (jurisdictions <> '{}')
);

CREATE INDEX task_specs_topic_idx ON task_specs (topic);
CREATE INDEX task_specs_jurisdictions_idx ON task_specs USING gin (jurisdictions);
CREATE INDEX task_specs_matter_idx ON task_specs (matter_id) WHERE matter_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- claim_ledgers — one row per orchestration session
-- ----------------------------------------------------------------------------

CREATE TABLE claim_ledgers (
  id                 text PRIMARY KEY,
  task_spec_id       text NOT NULL REFERENCES task_specs(id) ON DELETE CASCADE,
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  head_hash          bytea,                          -- updated on every ledger_entries insert via trigger
  anchor             jsonb,                          -- external R2 anchor metadata when applicable
  matter_id          text,                           -- RLS scope for v6+
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX claim_ledgers_task_spec_idx ON claim_ledgers (task_spec_id);
CREATE INDEX claim_ledgers_open_idx ON claim_ledgers (started_at) WHERE ended_at IS NULL;
CREATE INDEX claim_ledgers_matter_idx ON claim_ledgers (matter_id) WHERE matter_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- ledger_entries — append-only hash-chained audit
--
-- prev_hash must equal the previous entry's this_hash (enforced via trigger).
-- The chain genesis is prev_hash = '\x00..00' (32 zero bytes).
-- ----------------------------------------------------------------------------

CREATE TABLE ledger_entries (
  id               bigserial PRIMARY KEY,
  claim_ledger_id  text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  position         int NOT NULL,
  kind             text NOT NULL,
  ts               timestamptz NOT NULL DEFAULT now(),
  actor            text NOT NULL,
  payload          jsonb NOT NULL,
  prev_hash        bytea NOT NULL,
  this_hash        bytea NOT NULL,

  UNIQUE (claim_ledger_id, position),
  CHECK (octet_length(prev_hash) = 32),
  CHECK (octet_length(this_hash) = 32)
);

CREATE INDEX ledger_entries_ts_idx ON ledger_entries (ts);
CREATE INDEX ledger_entries_kind_idx ON ledger_entries (kind);

-- Hash-chain enforcement: prev_hash on insert must match the most-recent
-- entry's this_hash for the same claim_ledger_id. Genesis entry (position=0)
-- has prev_hash = '\x00' x 32.
CREATE OR REPLACE FUNCTION enforce_ledger_chain()
RETURNS TRIGGER AS $$
DECLARE
  expected_prev bytea;
  last_pos int;
BEGIN
  SELECT this_hash, position INTO expected_prev, last_pos
    FROM ledger_entries
    WHERE claim_ledger_id = NEW.claim_ledger_id
    ORDER BY position DESC
    LIMIT 1;

  IF NOT FOUND THEN
    -- Genesis entry
    IF NEW.position <> 0 THEN
      RAISE EXCEPTION 'ledger_entries: first entry must have position=0 for ledger %', NEW.claim_ledger_id;
    END IF;
    IF NEW.prev_hash <> decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex') THEN
      RAISE EXCEPTION 'ledger_entries: genesis prev_hash must be 32 zero bytes for ledger %', NEW.claim_ledger_id;
    END IF;
  ELSE
    IF NEW.position <> last_pos + 1 THEN
      RAISE EXCEPTION 'ledger_entries: out-of-order position % (expected %) for ledger %', NEW.position, last_pos + 1, NEW.claim_ledger_id;
    END IF;
    IF NEW.prev_hash <> expected_prev THEN
      RAISE EXCEPTION 'ledger_entries: prev_hash mismatch for ledger % position % (expected %, got %)',
        NEW.claim_ledger_id, NEW.position, encode(expected_prev, 'hex'), encode(NEW.prev_hash, 'hex');
    END IF;
  END IF;

  -- Update claim_ledger.head_hash to this entry's this_hash
  UPDATE claim_ledgers SET head_hash = NEW.this_hash WHERE id = NEW.claim_ledger_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_enforce_chain
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_ledger_chain();

-- Refuse updates and deletes on ledger entries (audit immutability).
CREATE OR REPLACE FUNCTION refuse_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only; mutation refused on %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION refuse_mutation();

-- ----------------------------------------------------------------------------
-- claims — atomic legal claims emitted by the Drafter
-- ----------------------------------------------------------------------------

CREATE TABLE claims (
  id                  text PRIMARY KEY,
  claim_ledger_id     text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  ledger_position     int NOT NULL,
  kind                text NOT NULL,                 -- assertion | transition | definition | interpretation | conclusion
  text                text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  cites               jsonb NOT NULL DEFAULT '[]'::jsonb,
  quotes              jsonb NOT NULL DEFAULT '[]'::jsonb,
  relies_on_holding   boolean NOT NULL DEFAULT false,
  relies_on_exemption boolean NOT NULL DEFAULT false,
  relies_on_paraphrase boolean NOT NULL DEFAULT true,
  confidence          text,                          -- HIGH | MEDIUM | LOW
  verify_flag_id      text,
  canon_applied       jsonb NOT NULL DEFAULT '[]'::jsonb,
  matter_id           text,                          -- RLS scope for v6+

  CHECK (kind IN ('assertion','transition','definition','interpretation','conclusion'))
);

CREATE INDEX claims_ledger_idx ON claims (claim_ledger_id, ledger_position);
CREATE INDEX claims_matter_idx ON claims (matter_id) WHERE matter_id IS NOT NULL;
CREATE INDEX claims_kind_idx ON claims (kind);

-- ----------------------------------------------------------------------------
-- retrieval_log — every span retrieved this session
--
-- R3 / R4 / R5 validate against this. Lookup by (claim_ledger_id, hash) is
-- the hot path; the unique constraint makes it a single keyed lookup.
-- ----------------------------------------------------------------------------

CREATE TABLE retrieval_log (
  id                text PRIMARY KEY,
  claim_ledger_id   text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  doc_id            text NOT NULL,
  jurisdiction      text NOT NULL,
  source_category   text NOT NULL,
  source_id         text NOT NULL,
  tool_name         text NOT NULL,                    -- 'kb_statutes_search', 'kb_span_get_by_hash', etc.
  char_start        int,
  char_end          int,
  text              text NOT NULL,
  hash              bytea NOT NULL,
  live_hash         bytea,                            -- populated by Verifier on re-fetch (R5)
  current_through   date,
  retrieved_at      timestamptz NOT NULL DEFAULT now(),
  request_params    jsonb NOT NULL DEFAULT '{}'::jsonb,
  matter_id         text,                             -- RLS scope for v6+

  CONSTRAINT retrieval_log_hash_uniq UNIQUE (claim_ledger_id, hash)
);

CREATE INDEX retrieval_log_doc_idx ON retrieval_log (claim_ledger_id, doc_id);
CREATE INDEX retrieval_log_matter_idx ON retrieval_log (matter_id) WHERE matter_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- verifier_results — per-anchor Verifier output
-- ----------------------------------------------------------------------------

CREATE TABLE verifier_results (
  id              text PRIMARY KEY,
  claim_ledger_id text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  verified_at     timestamptz NOT NULL DEFAULT now(),
  anchors         jsonb NOT NULL,                    -- per-anchor records (matches verifier-output.schema.json)
  summary         jsonb NOT NULL,                    -- counts: passed, hash_not_found, text_mismatch, corpus_drift, stale_*
  duration_ms     int
);

CREATE INDEX verifier_results_ledger_idx ON verifier_results (claim_ledger_id);

-- ----------------------------------------------------------------------------
-- confidence_results — per-run Confidence sub-agent output
-- ----------------------------------------------------------------------------

CREATE TABLE confidence_results (
  id              text PRIMARY KEY,
  claim_ledger_id text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  criteria        jsonb NOT NULL,                    -- nine criteria with level + rationale + evidence
  aggregate       text NOT NULL,                     -- HIGH | MEDIUM | LOW
  incomplete_response_payload jsonb,

  CHECK (aggregate IN ('HIGH','MEDIUM','LOW'))
);

CREATE INDEX confidence_results_ledger_idx ON confidence_results (claim_ledger_id);

-- ----------------------------------------------------------------------------
-- classification_results — R12 overlay
-- ----------------------------------------------------------------------------

CREATE TABLE classification_results (
  id                 text PRIMARY KEY,
  claim_ledger_id    text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  taxonomy_version   bytea NOT NULL,                 -- sha256 of risk-taxonomy.yaml at run start
  categories         jsonb NOT NULL,                 -- {category_name: {status, severity, rationale, cite_refs}}
  completeness       jsonb NOT NULL
);

CREATE INDEX classification_results_ledger_idx ON classification_results (claim_ledger_id);

-- ----------------------------------------------------------------------------
-- completeness_results — R15 7-criterion check
-- ----------------------------------------------------------------------------

CREATE TABLE completeness_results (
  id                 text PRIMARY KEY,
  claim_ledger_id    text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  criteria           jsonb NOT NULL,                 -- 7 criteria with status + reason + supporting_doc_ids
  aggregate          text NOT NULL,                  -- complete | incomplete
  incomplete_response_recommendation jsonb,

  CHECK (aggregate IN ('complete','incomplete'))
);

CREATE INDEX completeness_results_ledger_idx ON completeness_results (claim_ledger_id);

-- ----------------------------------------------------------------------------
-- deliverables — rendered output
-- ----------------------------------------------------------------------------

CREATE TABLE deliverables (
  id                  text PRIMARY KEY,
  claim_ledger_id     text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  task_spec_id        text NOT NULL REFERENCES task_specs(id) ON DELETE CASCADE,
  stamp               text NOT NULL,
  bottom_line         text NOT NULL,
  rendered_at         timestamptz NOT NULL DEFAULT now(),
  delivery_channel    text NOT NULL,
  delivery_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_sent_at    timestamptz,
  payload             jsonb NOT NULL,                -- full deliverable per schemas/deliverable.schema.json
  matter_id           text,

  CHECK (stamp IN ('DRAFT FOR COUNSEL REVIEW','RESEARCH INCOMPLETE — DO NOT RELY ON THIS DRAFT'))
);

CREATE INDEX deliverables_ledger_idx ON deliverables (claim_ledger_id);
CREATE INDEX deliverables_task_spec_idx ON deliverables (task_spec_id);
CREATE INDEX deliverables_matter_idx ON deliverables (matter_id) WHERE matter_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- audit_anchors — external head-hash anchors (R2 bucket snapshots)
-- ----------------------------------------------------------------------------

CREATE TABLE audit_anchors (
  id                  bigserial PRIMARY KEY,
  claim_ledger_id     text NOT NULL REFERENCES claim_ledgers(id) ON DELETE CASCADE,
  head_hash_at_anchor bytea NOT NULL,
  external_bucket     text NOT NULL,
  external_key        text NOT NULL,
  anchored_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_anchors_ledger_idx ON audit_anchors (claim_ledger_id);

COMMIT;

-- ============================================================================
-- END 0001_init.sql
-- ============================================================================
