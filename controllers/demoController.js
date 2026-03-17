const fs = require('fs');
const path = require('path');
const { staging_queue, repository, audit_log } = require('./mockDb');

const uploadsDir = path.join(__dirname, '../uploads');

/**
 * Common function to clean up files for a given session
 */
const cleanupSessionFiles = async (sessionId) => {
  try {
    const allFiles = [
      ...staging_queue.filter(r => r.session_id === sessionId),
      ...repository.filter(r => r.session_id === sessionId)
    ].map(row => row.file_path);
    
    for (const filePath of allFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error(`Error cleaning up files for session ${sessionId}:`, error);
  }
};

/**
 * DELETE /api/demo/reset
 */
const resetDemo = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    await cleanupSessionFiles(sessionId);
    
    for (let i = staging_queue.length - 1; i >= 0; i--) if (staging_queue[i].session_id === sessionId) staging_queue.splice(i, 1);
    for (let i = repository.length - 1; i >= 0; i--) if (repository[i].session_id === sessionId) repository.splice(i, 1);
    for (let i = audit_log.length - 1; i >= 0; i--) if (audit_log[i].session_id === sessionId) audit_log.splice(i, 1);

    res.status(200).json({ success: true, message: 'Session data reset successfully' });
  } catch (error) {
    console.error('Demo reset failed:', error);
    res.status(500).json({ success: false, error: 'Failed to reset demo data' });
  }
};

/**
 * Background Job: Garbage clean expired sessions (>30 mins old)
 */
const cleanupExpiredSessions = async () => {
  try {
    console.log('Running background cleanup job for expired sessions...');
    
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const expiredSessions = [...new Set(audit_log.filter(l => l.timestamp < cutoff).map(l => l.session_id))];
    
    if (expiredSessions.length === 0) {
      console.log('No expired sessions found to clean up.');
      return;
    }
    
    console.log(`Found ${expiredSessions.length} expired session(s) to purge: ${expiredSessions.join(', ')}`);
    
    for (const sessionId of expiredSessions) {
      await cleanupSessionFiles(sessionId);
      
      for (let i = staging_queue.length - 1; i >= 0; i--) if (staging_queue[i].session_id === sessionId) staging_queue.splice(i, 1);
      for (let i = repository.length - 1; i >= 0; i--) if (repository[i].session_id === sessionId) repository.splice(i, 1);
      for (let i = audit_log.length - 1; i >= 0; i--) if (audit_log[i].session_id === sessionId) audit_log.splice(i, 1);
      
      console.log(`Successfully purged session: ${sessionId}`);
    }
    
  } catch (error) {
    console.error('Error in background cleanup job:', error);
  }
};

module.exports = {
  resetDemo,
  cleanupExpiredSessions
};
