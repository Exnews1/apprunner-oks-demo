const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Create a local express instance to mount our components solely for testing
const app = express();
app.use(express.json());

const upload = require('../middleware/upload');
const { 
  uploadDocument, 
  getPendingDocuments, 
  approveDocument, 
  rejectDocument, 
  modifyDocument, 
  getRepository 
} = require('../controllers/documentController');
const { getAuditLogs } = require('../controllers/auditController');

// Mock `pg` connection to isolate Postgres tests, OR use the native running Postgres container.
// Given node's execution context relative to docker, it's easier to mock DB logic 
// when not running *inside* compose, or we use integration tests straight to localhost:3000

// We will use native localhost integration to fully exercise the API endpoint 
// with the real database that we just spun up in Docker.

const BASE_URL = 'http://localhost:3000';
const TEST_SESSION_ID = 'test-session-1234-abcd';
const TEST_SESSION_ID_2 = 'test-session-5678-efgh';

describe('Document Intelligence Engine API', () => {
  let stagedDocId = null;

  beforeAll(() => {
    // Ensure test file exists
    fs.writeFileSync('test-upload.pdf', 'Dummy PDF content');
    fs.writeFileSync('test-upload.txt', 'Dummy TXT content');
    fs.writeFileSync('test-upload.exe', 'Malicious content');
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync('test-upload.pdf')) fs.unlinkSync('test-upload.pdf');
    if (fs.existsSync('test-upload.txt')) fs.unlinkSync('test-upload.txt');
    if (fs.existsSync('test-upload.exe')) fs.unlinkSync('test-upload.exe');
  });

  describe('Health Check', () => {
    it('should return 200 OK from health endpoint', async () => {
      const res = await request(BASE_URL).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('Classification Engine Accuracy', () => {
    // A quick way to hit the service directly to ensure its mapping is correct
    const { classifyDocument } = require('../services/classificationService');

    it('should classify Policy correctly', () => {
      const result = classifyDocument('Data_Policy_v1.pdf', 'shall comply with this policy');
      expect(result.doc_type).toBe('Policy');
    });

    it('should classify SOP correctly', () => {
      const result = classifyDocument('Taxonomy_SOP.docx', 'Step 1: do this standard operating thing');
      expect(result.doc_type).toBe('SOP');
    });

    it('should classify Training Material correctly', () => {
      const result = classifyDocument('Training_Guide.pdf', 'welcome to the handbook');
      expect(result.doc_type).toBe('Handbook');
    });

    it('should classify Memorandum correctly', () => {
      const result = classifyDocument('Memo_Pilot.txt', 'From: Boss');
      expect(result.doc_type).toBe('Memo');
    });

    it('should classify Procedure correctly', () => {
      const result = classifyDocument('Procedure.pdf', 'instructions for procedure');
      expect(result.doc_type).toBe('Procedure');
    });

    it('should classify Form correctly', () => {
      const result = classifyDocument('Form.pdf', 'please fill applicant form');
      expect(result.doc_type).toBe('Form');
    });

    it('should classify Other correctly when no patterns match', () => {
      const result = classifyDocument('Random.txt', 'random talk');
      expect(result.doc_type).toBe('Other');
    });
  });

  describe('Document Upload & Multer Validation', () => {
    it('should reject invalid file types (e.g. .exe)', async () => {
      const res = await request(BASE_URL)
        .post('/api/documents/upload')
        .set('x-session-id', TEST_SESSION_ID)
        .attach('document', 'test-upload.exe');
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid file type/);
    });

    it('should accept valid PDF uploads and ingest them into the staging queue', async () => {
      const res = await request(BASE_URL)
        .post('/api/documents/upload')
        .set('x-session-id', TEST_SESSION_ID)
        .attach('document', 'test-upload.pdf');
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.original_name).toBe('test-upload.pdf');
      
      stagedDocId = res.body.data.id;
    });
  });

  describe('Staging Queue Retreival', () => {
    it('should retrieve pending documents', async () => {
      const res = await request(BASE_URL)
        .get('/api/documents/pending')
        .set('x-session-id', TEST_SESSION_ID);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      const found = res.body.data.find(d => d.id === stagedDocId);
      expect(found).toBeDefined();
    });
  });

  describe('Staging Mutations', () => {
    it('should modify a document classification and recalculate its standard name', async () => {
      const payload = {
        doc_type: 'Policy',
        subject: 'Finance',
        actor: 'Test Script'
      };

      const res = await request(BASE_URL)
        .put(`/api/documents/${stagedDocId}/modify`)
        .set('x-session-id', TEST_SESSION_ID)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.doc_type).toBe('Policy');
      expect(res.body.data.subject).toBe('Finance');
      // Ensure name was dynamically recalculated based on deterministic rules
      expect(res.body.data.standard_name).toContain('POL-'); 
    });
  });

  describe('Document Actions', () => {
    it('should approve a document and move it to the repository', async () => {
      const payload = { actor: 'Test Approver' };
      const res = await request(BASE_URL)
        .post(`/api/documents/${stagedDocId}/approve`)
        .set('x-session-id', TEST_SESSION_ID)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should no longer display the document in pending queue', async () => {
      const res = await request(BASE_URL)
        .get('/api/documents/pending')
        .set('x-session-id', TEST_SESSION_ID);
      const found = res.body.data.find(d => d.id === stagedDocId);
      expect(found).toBeUndefined();
    });

    it('should display the approved document in the repository', async () => {
      const res = await request(BASE_URL)
        .get('/api/documents/repository')
        .set('x-session-id', TEST_SESSION_ID);
      expect(res.status).toBe(200);
      const found = res.body.data.find(d => d.original_name === 'test-upload.pdf');
      expect(found).toBeDefined();
    });
  });

  describe('Audit Trail Governance', () => {
    it('should fetch the audit log containing recent upload, modify, and approval actions', async () => {
      const res = await request(BASE_URL)
        .get('/api/audit')
        .set('x-session-id', TEST_SESSION_ID);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const logs = res.body.data;
      expect(Array.isArray(logs)).toBe(true);
      
      const actions = logs.map(l => l.action);
      expect(actions).toContain('UPLOAD');
      expect(actions).toContain('CLASSIFY');
      expect(actions).toContain('MODIFY');
      expect(actions).toContain('APPROVE');
    });
  });

  describe('Session Isolation & Demo Reset', () => {
    it('should not see documents from Session 1 in Session 2', async () => {
      const res = await request(BASE_URL)
        .get('/api/documents/repository')
        .set('x-session-id', TEST_SESSION_ID_2);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it('should correctly reset the demo and delete Session 1 data', async () => {
      const res = await request(BASE_URL)
        .delete('/api/demo/reset')
        .set('x-session-id', TEST_SESSION_ID);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the repo is now empty for session 1
      const repoRes = await request(BASE_URL)
        .get('/api/documents/repository')
        .set('x-session-id', TEST_SESSION_ID);
      expect(repoRes.body.data.length).toBe(0);
    });
  });
});
