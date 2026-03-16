require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Multer middleware
const upload = require('./middleware/upload');

// Controllers
const { pool, getAuditLogs } = require('./controllers/auditController');
const { 
  uploadDocument, 
  getPendingDocuments, 
  approveDocument, 
  rejectDocument, 
  modifyDocument, 
  getRepository 
} = require('./controllers/documentController');
const { resetDemo, cleanupExpiredSessions } = require('./controllers/demoController');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection is handled in auditController.js automatically
// We export the pool from there to assure singleton-like connectivity.

// Serve static frontend from the /public directory for the demo UI
app.use(express.static(path.join(__dirname, 'public')));

// Health-check endpoint for infrastructure verification
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW()');
    const latency = Date.now() - start;
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbLatencyMs: latency,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Document Workflow Endpoints
app.post('/api/documents/upload', upload.single('document'), uploadDocument);
app.get('/api/documents/pending', getPendingDocuments);
app.post('/api/documents/:id/approve', approveDocument);
app.post('/api/documents/:id/reject', rejectDocument);
app.put('/api/documents/:id/modify', modifyDocument);
app.get('/api/documents/repository', getRepository);

// Governance Endpoints
app.get('/api/audit', getAuditLogs);

// Demo Endpoints
app.delete('/api/demo/reset', resetDemo);

// Serve static frontend from the /public directory for the demo UI
app.use(express.static(path.join(__dirname, 'public')));
app.use('/demo', express.static(path.join(__dirname, 'public')));

// React Router handling for the frontend SPA (ignores files with extensions)
app.get(/^\/demo(\/.*)?$/, (req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Custom error handling middleware for Multer (to catch fileFilter rejections natively)
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, error: err.message });
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
  }
  next(err);
});

// Start server
app.listen(port, () => {
  console.log(`OKS Document Intelligence Engine backend running on port ${port}`);
  
  // Start the 10-minute background cleanup job
  setInterval(cleanupExpiredSessions, 10 * 60 * 1000);
});
