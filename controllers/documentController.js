const fs = require('fs');
const { createAuditLog } = require('./auditController');
const { staging_queue, repository, getId } = require('./mockDb');
const { classifyDocument, generateStandardName } = require('../services/classificationService');

const uploadDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded or invalid file type.' });

  const { originalname, path: filePath, mimetype } = req.file;

  try {
    await createAuditLog(sessionId, 'System', 'UPLOAD', `Document "${originalname}" ingested`);
    const classification = classifyDocument(originalname, ""); 
    const standardName = generateStandardName(classification, originalname);

    const stagedDoc = {
      id: getId(),
      session_id: sessionId,
      original_name: originalname,
      standard_name: standardName,
      file_path: filePath,
      doc_type: classification.doc_type,
      subject: classification.subject,
      department: classification.department,
      effective_date: classification.effective_date,
      responsible_party: classification.responsible_party,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      status: 'pending',
      uploaded_at: new Date()
    };
    staging_queue.push(stagedDoc);

    await createAuditLog(sessionId, 'AI Engine', 'CLASSIFY', `AI classified "${originalname}" as ${classification.doc_type} (${(classification.confidence * 100).toFixed(0)}% confidence)`);
    await createAuditLog(sessionId, 'Rules Engine', 'STANDARDIZE', `Proposed name: ${standardName}`);

    res.status(201).json({ success: true, data: stagedDoc });
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error processing document.' });
  }
};

const getPendingDocuments = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    const pending = staging_queue
      .filter(d => d.session_id === sessionId && d.status === 'pending')
      .sort((a, b) => b.uploaded_at - a.uploaded_at);
    res.status(200).json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve staging queue.' });
  }
};

const approveDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  const { id } = req.params;
  const actor = req.body.actor || 'Operations Manager';

  try {
    const docIndex = staging_queue.findIndex(d => d.id === id && d.session_id === sessionId && d.status === 'pending');
    if (docIndex === -1) return res.status(404).json({ success: false, error: 'Document not found or already processed.' });
    
    const doc = staging_queue[docIndex];
    
    const repoDoc = {
      id: getId(),
      session_id: sessionId,
      original_name: doc.original_name,
      standard_name: doc.standard_name,
      file_path: doc.file_path,
      doc_type: doc.doc_type,
      subject: doc.subject,
      department: doc.department,
      effective_date: doc.effective_date,
      responsible_party: doc.responsible_party,
      confidence: doc.confidence,
      approved_by: actor,
      approved_at: new Date()
    };
    repository.push(repoDoc);

    doc.status = 'approved';
    doc.reviewed_at = new Date();
    doc.reviewed_by = actor;
    
    await createAuditLog(sessionId, actor, 'APPROVE', `"${doc.original_name}" approved as "${doc.standard_name}"`);
    res.status(200).json({ success: true, data: repoDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve document.' });
  }
};

const rejectDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  const { id } = req.params;
  const actor = req.body.actor || 'Operations Manager';
  const reason = req.body.reason || 'classification deemed inaccurate';

  try {
    const docIndex = staging_queue.findIndex(d => d.id === id && d.session_id === sessionId);
    if (docIndex === -1) return res.status(404).json({ success: false, error: 'Document not found.' });
    
    const doc = staging_queue[docIndex];
    doc.status = 'rejected';
    doc.reviewed_at = new Date();
    doc.reviewed_by = actor;

    await createAuditLog(sessionId, actor, 'REJECT', `"${doc.original_name}" rejected — ${reason}`);
    res.status(200).json({ success: true, message: 'Document rejected successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject document.' });
  }
};

const modifyDocument = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  const { id } = req.params;
  const { doc_type, subject, actor = 'Operations Manager' } = req.body;

  if (!doc_type && !subject) return res.status(400).json({ success: false, error: 'Must provide modifications.' });

  try {
    const docIndex = staging_queue.findIndex(d => d.id === id && d.session_id === sessionId && d.status === 'pending');
    if (docIndex === -1) return res.status(404).json({ success: false, error: 'Document not found or already processed.' });
    
    const doc = staging_queue[docIndex];
    const newDocType = doc_type || doc.doc_type;
    const newSubject = subject || doc.subject;

    const simulatedClassificationObj = {
      doc_type: newDocType,
      subject: newSubject,
      department: doc.department,
      effective_date: doc.effective_date
    };
    
    const newStandardName = generateStandardName(simulatedClassificationObj, doc.original_name);

    doc.doc_type = newDocType;
    doc.subject = newSubject;
    doc.standard_name = newStandardName;

    await createAuditLog(sessionId, actor, 'MODIFY', `"${doc.original_name}" classification modified: ${newDocType} / ${newSubject}. New name: ${newStandardName}`);
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to modify document.' });
  }
};

const getRepository = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    const repos = repository
      .filter(d => d.session_id === sessionId)
      .sort((a, b) => b.approved_at - a.approved_at);
    res.status(200).json({ success: true, data: repos });
  } catch (error) {
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
