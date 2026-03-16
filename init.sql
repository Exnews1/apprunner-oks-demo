CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS taxonomy_config (
  id SERIAL PRIMARY KEY,
  doc_types TEXT[] DEFAULT ARRAY['Policy','SOP','Procedure','Form','Handbook','Memo','Other'],
  subjects TEXT[] DEFAULT ARRAY['HR','Safety','Finance','IT','Legal','Operations','General'],
  departments TEXT[] DEFAULT ARRAY['Human Resources','Health & Safety','Finance','Information Technology','Legal & Compliance','Operations'],
  naming_template TEXT DEFAULT '[TypeCode]-[DeptCode]-[Subject]-[Date]-[Version]',
  org_name TEXT DEFAULT 'Default Organization',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default taxonomy config if not exists
INSERT INTO taxonomy_config (org_name)
SELECT 'Organizational Knowledge Systems LLC'
WHERE NOT EXISTS (SELECT 1 FROM taxonomy_config);

CREATE TABLE IF NOT EXISTS staging_queue (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  original_name TEXT NOT NULL,
  standard_name TEXT,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  doc_type TEXT,
  subject TEXT,
  department TEXT,
  effective_date TEXT,
  responsible_party TEXT,
  confidence DECIMAL(3,2),
  reasoning TEXT,
  status TEXT DEFAULT 'pending',  -- pending | approved | rejected
  uploaded_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repository (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  original_name TEXT NOT NULL,
  standard_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  department TEXT NOT NULL,
  effective_date TEXT,
  responsible_party TEXT,
  confidence DECIMAL(3,2),
  approved_at TIMESTAMP DEFAULT NOW(),
  approved_by TEXT DEFAULT 'Operations Manager',
  content_embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Force cleanup of any old test data on init
DELETE FROM staging_queue;
DELETE FROM repository;
DELETE FROM audit_log;
