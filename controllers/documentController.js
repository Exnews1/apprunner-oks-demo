const fs = require('fs');
const { pool, createAuditLog } = require('./auditController');
const { classifyDocument, generateStandardName } = require('../services/classificationService');

/**
 * POST /api/documents/upload
 * Handles document ingestion and simulated AI classification.
 */
const uploadDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded or invalid file type.' });
  }

  const { originalname, path: filePath, mimetype } = req.file;

  try {
    // 1. Ingestion: Log upload receipt
    await createAuditLog(sessionId, 'System', 'UPLOAD', `Document "${originalname}" ingested`);

    // 2. Extracion/Simulated AI Classification
    // In a real system, we'd extract text from the path here and send to LLM.
    const classification = classifyDocument(originalname, ""); 

    // 3. Standardization: Generate file name based on AI properties
    const standardName = generateStandardName(classification, originalname);

    // 4. Staging Queue: Insert into staging DB
    const insertQuery = `
      INSERT INTO staging_queue 
        (session_id, original_name, standard_name, file_path, doc_type, subject, department, effective_date, responsible_party, confidence, reasoning, status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
      RETURNING *;
    `;
    
    const values = [
      sessionId,
      originalname,
      standardName,
      filePath,
      classification.doc_type,
      classification.subject,
      classification.department,
      classification.effective_date,
      classification.responsible_party,
      classification.confidence,
      classification.reasoning
    ];

    const result = await pool.query(insertQuery, values);
    const stagedDoc = result.rows[0];

    // Log the AI classification action
    await createAuditLog(sessionId, 'AI Engine', 'CLASSIFY', `AI classified "${originalname}" as ${classification.doc_type} (${(classification.confidence * 100).toFixed(0)}% confidence)`);
    await createAuditLog(sessionId, 'Rules Engine', 'STANDARDIZE', `Proposed name: ${standardName}`);

    res.status(201).json({
      success: true,
      data: stagedDoc
    });
  } catch (error) {
    console.error('Error during upload processing:', error);
    // Cleanup the uploaded file if database insert fails
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false, error: 'Internal server error processing document.' });
  }
};

/**
 * GET /api/documents/pending
 * Retrieve all documents awaiting human review.
 */
const getPendingDocuments = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    const result = await pool.query(`
      SELECT * FROM staging_queue 
      WHERE status = 'pending' AND session_id = $1
      ORDER BY uploaded_at DESC
    `, [sessionId]);
    
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching pending documents:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve staging queue.' });
  }
};

/**
 * POST /api/documents/:id/approve
 * Promotes a document to the permanent knowledge repository.
 */
const approveDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  const { id } = req.params;
  const actor = req.body.actor || 'Operations Manager';

  try {
    // Begin transaction
    await pool.query('BEGIN');

    const stagingResult = await pool.query(`SELECT * FROM staging_queue WHERE id = $1 AND session_id = $2 AND status = 'pending'`, [id, sessionId]);
    if (stagingResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Document not found or already processed.' });
    }
    const doc = stagingResult.rows[0];

    // Insert into repository
    const repoInsertQuery = `
      INSERT INTO repository 
        (session_id, original_name, standard_name, file_path, doc_type, subject, department, effective_date, responsible_party, confidence, approved_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const repoValues = [
      sessionId, doc.original_name, doc.standard_name, doc.file_path, doc.doc_type, doc.subject,
      doc.department, doc.effective_date, doc.responsible_party, doc.confidence, actor
    ];
    
    const repoResult = await pool.query(repoInsertQuery, repoValues);

    // Mark staged document as approved
    await pool.query(`UPDATE staging_queue SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1 WHERE id = $2 AND session_id = $3`, [actor, id, sessionId]);
    
    // Audit Log
    await createAuditLog(sessionId, actor, 'APPROVE', `"${doc.original_name}" approved as "${doc.standard_name}"`);

    await pool.query('COMMIT');
    res.status(200).json({ success: true, data: repoResult.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Approval failed:', error);
    res.status(500).json({ success: false, error: 'Failed to approve document.' });
  }
};

/**
 * POST /api/documents/:id/reject
 * Marks a document as rejected.
 */
const rejectDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  const { id } = req.params;
  const actor = req.body.actor || 'Operations Manager';
  const reason = req.body.reason || 'classification deemed inaccurate';

  try {
    const getResult = await pool.query(`SELECT original_name FROM staging_queue WHERE id = $1 AND session_id = $2`, [id, sessionId]);
    if (getResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    await pool.query(`UPDATE staging_queue SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1 WHERE id = $2 AND session_id = $3`, [actor, id, sessionId]);
    
    const originalName = getResult.rows[0].original_name;
    await createAuditLog(sessionId, actor, 'REJECT', `"${originalName}" rejected — ${reason}`);

    res.status(200).json({ success: true, message: 'Document rejected successfully.' });
  } catch (error) {
    console.error('Rejection failed:', error);
    res.status(500).json({ success: false, error: 'Failed to reject document.' });
  }
};

/**
 * PUT /api/documents/:id/modify
 * Modifies the classification of a pending document and regenerates the standard name.
 */
const modifyDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  const { id } = req.params;
  const { doc_type, subject, actor = 'Operations Manager' } = req.body;

  if (!doc_type && !subject) {
    return res.status(400).json({ success: false, error: 'Must provide doc_type or subject to modify.' });
  }

  try {
    const stagingResult = await pool.query(`SELECT * FROM staging_queue WHERE id = $1 AND session_id = $2 AND status = 'pending'`, [id, sessionId]);
    if (stagingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found or already processed.' });
    }
    
    const doc = stagingResult.rows[0];
    const newDocType = doc_type || doc.doc_type;
    const newSubject = subject || doc.subject;

    // We must mimic the classification object to feed it back into generateStandardName
    const simulatedClassificationObj = {
      doc_type: newDocType,
      subject: newSubject,
      department: doc.department,
      effective_date: doc.effective_date
    };
    
    // Regenerate standard name purely based on deterministic rules
    const newStandardName = generateStandardName(simulatedClassificationObj, doc.original_name);

    // Update the database record
    const updateResult = await pool.query(`
      UPDATE staging_queue 
      SET doc_type = $1, subject = $2, standard_name = $3
      WHERE id = $4 AND session_id = $5
      RETURNING *;
    `, [newDocType, newSubject, newStandardName, id, sessionId]);

    // Atomic Audit Logging
    await createAuditLog(sessionId, actor, 'MODIFY', `"${doc.original_name}" classification modified: ${newDocType} / ${newSubject}. New name: ${newStandardName}`);

    res.status(200).json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Modification failed:', error);
    res.status(500).json({ success: false, error: 'Failed to modify document.' });
  }
};

/**
 * GET /api/documents/repository
 * Fetch all documents stored in the permanent repository.
 */
const getRepository = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    const result = await pool.query(`
      SELECT * FROM repository 
      WHERE session_id = $1
      ORDER BY approved_at DESC
    `, [sessionId]);
    
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching repository:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve repository.' });
  }
};

module.exports = {
  uploadDocument,
  getPendingDocuments,
  approveDocument,
  rejectDocument,
  modifyDocument,
  getRepository
};
