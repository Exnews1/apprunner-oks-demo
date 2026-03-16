import React, { useState, useEffect } from 'react';
import { Network, Database, BrainCircuit, Activity, FileCheck, XCircle, FileEdit } from 'lucide-react';

const ACTION_CONFIG = {
  'UPLOAD': { icon: UploadIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'CLASSIFY': { icon: BrainCircuit, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'STANDARDIZE': { icon: Database, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  'APPROVE': { icon: FileCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'REJECT': { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  'MODIFY': { icon: FileEdit, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

function UploadIcon(props) {
  return <Network {...props} />;
}

const AuditTrail = ({ sessionId, refreshTrigger }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (sessionId) fetchLogs();
  }, [sessionId, refreshTrigger]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit?limit=20', {
        headers: { 'x-session-id': sessionId }
      });
      const data = await res.json();
      if (data.success) setLogs(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[400px]">
      <div className="bg-slate-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center">
          <Activity size={12} className="mr-1.5 text-slate-400" />
          Live Event Stream
        </span>
        <span className="text-[10px] text-slate-400 font-mono">APPEND-ONLY</span>
      </div>
      
      <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {logs.length === 0 ? (
          <p className="text-xs text-center text-gray-400 py-4 font-mono">Awaiting system events...</p>
        ) : (
          logs.map((log) => {
            const config = ACTION_CONFIG[log.action] || { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' };
            const Icon = config.icon;

            return (
              <div key={log.id} className={`p-3 rounded-lg border text-sm animate-in slide-in-from-left-2 ${config.bg} ${config.border}`}>
                <div className="flex items-start">
                  <div className={`mt-0.5 mr-3 p-1.5 rounded-md bg-white shadow-sm ${config.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`font-semibold text-xs uppercase tracking-wider ${config.color}`}>{log.action}</span>
                      <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap ml-2">{formatTime(log.timestamp)}</span>
                    </div>
                    <p className="text-gray-800 text-xs mt-1 leading-snug">{log.details}</p>
                    <div className="mt-1.5 text-[10px] text-gray-500 font-mono">
                      Actor: {log.actor}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
