const fs = require('fs');
const path = require('path');
const { pool } = require('./auditController'); // using the same pool instance

const uploadsDir = path.join(__dirname, '../uploads');

/**
 * Common function to clean up files for a given session
 */
const cleanupSessionFiles = async (sessionId) => {
  try {
    // 1. Get all file paths for this session from staging and repository
    const stagingQuery = `SELECT file_path FROM staging_queue WHERE session_id = $1`;
    const repoQuery = `SELECT file_path FROM repository WHERE session_id = $1`;
    
    const [stagingResult, repoResult] = await Promise.all([
      pool.query(stagingQuery, [sessionId]),
      pool.query(repoQuery, [sessionId])
    ]);
    
    const allFiles = [...stagingResult.rows, ...repoResult.rows].map(row => row.file_path);
    
    // 2. Delete each file from disk if it exists
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
 * Deletes all rows matching x-session-id and associated files.
 */
const resetDemo = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    // Cleanup files first before we delete the DB rows listing those files
    await cleanupSessionFiles(sessionId);

    // Delete DB rows
    await pool.query('BEGIN');
    
    await pool.query('DELETE FROM staging_queue WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM repository WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM audit_log WHERE session_id = $1', [sessionId]);
    
    await pool.query('COMMIT');
    
    res.status(200).json({ success: true, message: 'Session data reset successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
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
    
    // 1. Find sessions older than 30 mins
    // Since created_at shouldn't change, we just find any row older than 30 mins.
    // We can query distinct sessions from audit_log (since every upload hits audit_log first)
    const expiredSessionsQuery = `
      SELECT DISTINCT session_id 
      FROM audit_log 
      WHERE created_at < NOW() - INTERVAL '30 minutes'
    `;
    
    const result = await pool.query(expiredSessionsQuery);
    const expiredSessionIds = result.rows.map(row => row.session_id);
    
    if (expiredSessionIds.length === 0) {
      console.log('No expired sessions found to clean up.');
      return;
    }
    
    console.log(`Found ${expiredSessionIds.length} expired session(s) to purge: ${expiredSessionIds.join(', ')}`);
    
    // 2. For each expired session, clean up files then delete rows
    for (const sessionId of expiredSessionIds) {
      await cleanupSessionFiles(sessionId);
      
      // Delete DB rows
      await pool.query('BEGIN');
      await pool.query('DELETE FROM staging_queue WHERE session_id = $1', [sessionId]);
      await pool.query('DELETE FROM repository WHERE session_id = $1', [sessionId]);
      await pool.query('DELETE FROM audit_log WHERE session_id = $1', [sessionId]);
      await pool.query('COMMIT');
      
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
