import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Edit3, X, Save } from 'lucide-react';

const StagingQueue = ({ sessionId, refreshTrigger, onActionSuccess }) => {
  const [documentsData, setDocumentsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ doc_type: '', subject: '' });
  const [processingIds, setProcessingIds] = useState(new Set());

  useEffect(() => {
    fetchPending();
  }, [sessionId, refreshTrigger]);

  const fetchPending = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents/pending', {
        headers: { 'x-session-id': sessionId }
      });
      const data = await res.json();
      if (data.success) setDocumentsData(data.data);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handeAction = async (id, action) => {
    if (processingIds.has(id)) return;
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/documents/${id}/${action}`, {
        method: 'POST',
        headers: { 
          'x-session-id': sessionId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actor: 'Demo User' })
      });
      onActionSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleModify = async (id) => {
    if (processingIds.has(id)) return;
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/documents/${id}/modify`, {
        method: 'PUT',
        headers: { 
          'x-session-id': sessionId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          doc_type: editForm.doc_type, 
          subject: editForm.subject,
          actor: 'Demo User'
        })
      });
      setEditingId(null);
      onActionSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const startEdit = (doc) => {
    setEditingId(doc.id);
    setEditForm({ doc_type: doc.doc_type, subject: doc.subject });
  };

  if (isLoading && documentsData.length === 0) {
    return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  }

  if (documentsData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">No documents in staging queue.</p>
        <p className="text-xs text-gray-400 mt-1">Upload files to begin the review process.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documentsData.map(doc => (
        <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
          
          <div className="p-4 border-b border-gray-100 bg-amber-50/30">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-gray-900">{doc.original_name}</h4>
                <div className="mt-1 flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-mono border border-gray-200">
                    {doc.standard_name}
                  </span>
                  <span className={`text-xs font-medium ${(doc.confidence * 100) > 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {(doc.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {editingId === doc.id ? (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Doc Type</label>
                    <input 
                      type="text" 
                      value={editForm.doc_type}
                      onChange={e => setEditForm({...editForm, doc_type: e.target.value.replace(/[^a-zA-Z0-9 ]/g, '')})}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Subject / Domain</label>
                    <input 
                      type="text" 
                      value={editForm.subject}
                      onChange={e => setEditForm({...editForm, subject: e.target.value.replace(/[^a-zA-Z0-9 ]/g, '')})}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <button onClick={() => setEditingId(null)} className="flex items-center text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                    <X size={14} className="mr-1" /> Cancel
                  </button>
                  <button onClick={() => handleModify(doc.id)} className="flex items-center text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50 transition-colors">
                    <Save size={14} className="mr-1" /> Save & Recalculate
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-gray-500 text-xs mb-0.5">Classification</span>
                  <span className="font-medium text-gray-900">{doc.doc_type}</span>
                </div>
                <div>
                  <span className="block text-gray-500 text-xs mb-0.5">Subject Domain</span>
                  <span className="font-medium text-gray-900">{doc.subject}</span>
                </div>
              </div>
            )}
          </div>

          {!editingId && editingId !== doc.id && (
            <div className="bg-gray-50 border-t border-gray-100 flex items-center justify-between px-4 py-2.5">
              <button 
                tabIndex="0"
                onClick={() => startEdit(doc)}
                className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors"
              >
                <Edit3 size={15} className="mr-1.5" /> Modify Rules
              </button>
              <div className="flex space-x-2">
                <button 
                  tabIndex="0"
                  onClick={() => handeAction(doc.id, 'reject')}
                  disabled={processingIds.has(doc.id)}
                  className="flex items-center text-sm font-medium text-rose-700 hover:text-rose-800 bg-white border border-rose-200 px-3 py-1.5 rounded shadow-sm hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  <XCircle size={15} className="mr-1.5" /> Reject
                </button>
                <button 
                  tabIndex="0"
                  onClick={() => handeAction(doc.id, 'approve')}
                  disabled={processingIds.has(doc.id)}
                  className="flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded shadow-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={15} className="mr-1.5" /> Approve Match
                </button>
              </div>
            </div>
          )}

        </div>
      ))}
    </div>
  );
};

export default StagingQueue;
