const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '50.17.88.250',
  database: process.env.DB_NAME || 'oks_intelligence',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

/**
 * Creates an append-only audit log entry scoped to a session.
 */
const createAuditLog = async (sessionId, actor, action, details) => {
  try {
    const query = `
      INSERT INTO audit_log (session_id, actor, action, details)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [sessionId, actor, action, details];
    await pool.query(query, values);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Real implementation might handle this more robustly, 
    // but we intentionally don't throw to prevent breaking the main transaction.
  }
};

/**
 * GET /api/audit
 * Fetches the most recent audit logs for a specific session.
 */
const getAuditLogs = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const query = `
      SELECT * FROM audit_log
      WHERE session_id = $1
      ORDER BY timestamp DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [sessionId, limit]);
    
    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit trail'
    });
  }
};

module.exports = {
  pool, // Exporting pool so documentController can use the same instance
  createAuditLog,
  getAuditLogs
};
