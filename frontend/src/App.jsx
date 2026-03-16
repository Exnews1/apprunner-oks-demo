import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RefreshCw, FileText, ArrowRight, ShieldCheck, Clock, UploadCloud, FileUp } from 'lucide-react';
import UploadZone from './components/UploadZone';
import StagingQueue from './components/StagingQueue';
import AuditTrail from './components/AuditTrail';
import RepositoryPanel from './components/RepositoryPanel';

const App = () => {
  const [sessionId, setSessionId] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 mins

  useEffect(() => {
    // 1. Session Management
    let sid = localStorage.getItem('demo_session_id');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('demo_session_id', sid);
    }
    setSessionId(sid);

    // 2. Timer Countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleReset();
          return 30 * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleReset = async () => {
    if (!sessionId) return;
    
    try {
      await fetch('/api/demo/reset', {
        method: 'DELETE',
        headers: { 'x-session-id': sessionId }
      });
      
      const newSid = uuidv4();
      localStorage.setItem('demo_session_id', newSid);
      setSessionId(newSid);
      setTimeLeft(30 * 60);
      triggerRefresh();
    } catch (err) {
      console.error('Failed to reset demo', err);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!sessionId) return <div className="p-8 text-center bg-gray-50 min-h-screen">Initializing Session...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-row items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-900 p-2 rounded-lg text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Organizational Knowledge Systems</h1>
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Document Intelligence Engine</h2>
          </div>
          <span className="ml-4 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
            Demo Mode
          </span>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center text-rose-600 bg-rose-50 px-3 py-1.5 rounded-md border border-rose-100">
            <Clock size={16} className="mr-2" />
            <span className="text-sm font-semibold font-mono">Session auto-resets in {formatTime(timeLeft)}</span>
          </div>
          <button 
            onClick={handleReset}
            className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-md transition-colors border border-transparent hover:border-slate-200"
          >
            <RefreshCw size={16} className="mr-2" />
            Reset Demo
          </button>
        </div>
      </header>

      {/* MAIN CONTENT SPLIT */}
      <main className="flex-grow flex flex-row overflow-hidden h-[calc(100vh-73px)]">
        
        {/* LEFT PANEL: Intake & Governance (45%) */}
        <div className="w-[45%] border-r border-gray-200 bg-gray-50 flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">
            
            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                <UploadCloud size={20} className="mr-2 text-blue-600" />
                1. Document Intake
              </h3>
              <UploadZone sessionId={sessionId} onUploadSuccess={triggerRefresh} />
            </section>

            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                <FileText size={20} className="mr-2 text-amber-500" />
                2. Staging Review Queue
              </h3>
              <StagingQueue sessionId={sessionId} refreshTrigger={refreshTrigger} onActionSuccess={triggerRefresh} />
            </section>

            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                <ShieldCheck size={20} className="mr-2 text-slate-600" />
                3. Governance Audit Trail
              </h3>
              <AuditTrail sessionId={sessionId} refreshTrigger={refreshTrigger} />
            </section>

          </div>
        </div>

        {/* RIGHT PANEL: Repository (55%) */}
        <div className="w-[55%] bg-white flex flex-col h-full overflow-y-auto">
          <RepositoryPanel sessionId={sessionId} refreshTrigger={refreshTrigger} />
        </div>

      </main>
    </div>
  );
}

export default App;
