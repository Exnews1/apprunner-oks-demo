const { audit_log, getId } = require('./mockDb');

const createAuditLog = async (sessionId, actor, action, details) => {
  try {
    const entry = {
      id: getId(),
      session_id: sessionId,
      actor,
      action,
      details,
      timestamp: new Date()
    };
    audit_log.push(entry);
    return entry;
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

const getAuditLogs = async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing x-session-id header' });

  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    
    const logs = audit_log
      .filter(log => log.session_id === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
      
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve audit trail' });
  }
};

const pool = {
  query: async (sql) => {
    // For server.js health check endpoint
    if (sql === 'SELECT NOW()') return { rows: [{ now: new Date() }] };
    return { rows: [] };
  }
};

module.exports = {
  pool,
  createAuditLog,
  getAuditLogs
};
