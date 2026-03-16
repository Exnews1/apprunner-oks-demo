import React, { useState, useEffect } from 'react';
import { Search, Filter, BookOpen, AlertTriangle, FileText, Briefcase, GraduationCap, HardHat, FileSignature, HelpCircle, Network, CheckCircle } from 'lucide-react';

// Maps KMS Categories to numeric hierarchy like prostaff KMS reference
const CATEGORY_MAP = {
  'Policy': { num: '1.1', icon: BookOpen, title: 'Policies & Directives', desc: 'Governing documents that establish organizational requirements, authorities, and constraints.' },
  'SOP': { num: '1.2', icon: FileText, title: 'Standard Operating Procedures', desc: 'Step-by-step procedural guidance for routine and non-routine operations.' },
  'Procedure': { num: '1.2', icon: FileText, title: 'Standard Operating Procedures', desc: 'Step-by-step procedural guidance for routine and non-routine operations.' },
  'Handbook': { num: '1.5', icon: GraduationCap, title: 'Training & Development', desc: 'Documentation for training programs, compliance training, interview techniques.' },
  'Memo': { num: '1.6', icon: Briefcase, title: 'Internal Memoranda', desc: 'Official internal communications, pilot announcements, and temporary edicts.' },
  'Form': { num: '1.7', icon: FileSignature, title: 'Forms & Templates', desc: 'Standardized forms for data collection, approvals, and legal execution.' },
  'Other': { num: '1.9', icon: HelpCircle, title: 'Unclassified Knowledge', desc: 'Knowledge items pending formal taxonomic review.' },
  // Additional mappings specifically to trigger icons/categories based on standard subjects if AI uses varied tokens
  'Training Material': { num: '1.5', icon: GraduationCap, title: 'Training & Development', desc: 'Documentation for training programs, compliance training, interview techniques.' },
};

const getCategory = (docType) => {
  return CATEGORY_MAP[docType] || CATEGORY_MAP['Other'];
};

const RepositoryPanel = ({ sessionId, refreshTrigger }) => {
  const [repoDocs, setRepoDocs] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (sessionId) fetchRepo();
  }, [sessionId, refreshTrigger]);

  const fetchRepo = async () => {
    try {
      const res = await fetch('/api/documents/repository', {
        headers: { 'x-session-id': sessionId }
      });
      const data = await res.json();
      if (data.success) setRepoDocs(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDocs = repoDocs.filter(d => 
    (d.standard_name || '').toLowerCase().includes(search.toLowerCase()) || 
    (d.original_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.doc_type || '').toLowerCase().includes(search.toLowerCase())
  );

  // Group by calculated category title
  const grouped = filteredDocs.reduce((acc, doc) => {
    const cat = getCategory(doc.doc_type);
    const title = cat?.title || 'Unclassified Knowledge';
    if (!acc[title]) {
      acc[title] = { meta: cat || CATEGORY_MAP['Other'], docs: [] };
    }
    acc[title].docs.push(doc);
    return acc;
  }, {});

  // Sort groups numerically by the section numbers (1.1, 1.2, etc.)
  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    const numA = grouped[a].meta.num || '9.9';
    const numB = grouped[b].meta.num || '9.9';
    return numA.localeCompare(numB);
  });

  return (
    <div className="flex flex-col h-full bg-white">
      
      {/* Top KMS Header (Matches ProStaff screenshot mapping) */}
      <div className="bg-[#FAF9F6] border-b border-gray-200 px-8 py-6">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
          ORGANIZATIONAL KNOWLEDGE SYSTEMS • DEMONSTRATION ENVIRONMENT
        </div>
        
        <div className="flex justify-between items-start">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-serif text-[#1F2937] font-bold mb-1">Workforce Operations Knowledge System</h2>
            <h3 className="text-lg text-teal-700 font-medium mb-4">Official Book of Knowledge Portal</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              This portal provides controlled access to the organization's operational documentation, policies, 
              standard operating procedures, contractual records, and compliance materials. Source documents are 
              automatically processed via the Document Intelligence Engine.
            </p>
            
            <div className="flex space-x-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search repository..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Filter size={16} className="mr-2" /> Filter
              </button>
            </div>
          </div>

          {/* System Status Widget (From Prostaff spec) */}
          <div className="w-64 bg-[#FAF9F6] border border-gray-300 rounded shadow-sm p-4 text-sm mt-2">
             <div className="flex items-center text-gray-700 font-semibold mb-4 text-xs tracking-wider uppercase">
               <Network size={14} className="mr-2 text-teal-700" /> System Status
             </div>
             <div className="space-y-3">
               <div className="flex justify-between items-center text-gray-600">
                 <span className="flex items-center"><CheckCircle size={14} className="mr-2 text-emerald-500" /> Active Records</span>
                 <span className="font-bold text-gray-900 text-base">{repoDocs.length}</span>
               </div>
               <div className="flex justify-between items-center text-gray-600">
                 <span className="flex items-center"><AlertTriangle size={14} className="mr-2 text-amber-500" /> Pending Review</span>
                 <span className="font-bold text-gray-900 text-base">Autosync</span>
               </div>
             </div>
             <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 flex items-center">
               Last update: Live Pipeline
             </div>
          </div>

        </div>
      </div>

      {/* Main Categories List */}
      <div className="flex-1 overflow-y-auto bg-white p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          
          <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-6">
            <h3 className="text-sm font-bold text-slate-800 tracking-wider">SECTION I — KNOWLEDGE CATEGORIES</h3>
            <span className="text-xs text-gray-500">Primary document classifications</span>
          </div>

          {repoDocs.length === 0 ? (
            <div className="text-center py-20 px-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Knowledge Repository Empty</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Approve documents from the Staging Review Queue on the left panel.
                Approved documents will be automatically categorized and published here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedGroupKeys.map(groupTitle => {
                const group = grouped[groupTitle];
                const meta = group.meta;
                const Icon = meta.icon;

                return (
                  <div key={groupTitle} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    {/* Category Header */}
                    <div className="bg-[#FAF9F6] px-5 py-4 border-b border-gray-200 flex items-start">
                      <div className="text-teal-700 font-semibold mr-4 text-lg">{meta.num}</div>
                      <div className="mt-1 mr-3 text-slate-400">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{groupTitle}</h4>
                        <p className="text-xs text-slate-500 mt-1">{meta.desc}</p>
                      </div>
                    </div>
                    
                    {/* Documents in Category */}
                    <div className="divide-y divide-gray-100">
                      {group.docs.map(doc => (
                        <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors animate-in fade-in">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="font-mono text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded shadow-sm mr-3">
                                {doc.standard_name}
                              </span>
                              <span className="text-sm text-gray-500 truncate max-w-sm">
                                {doc.original_name}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 font-mono w-48 text-right">
                            {doc.approved_at ? new Date(doc.approved_at).toISOString().split('T')[0] : 'Pending'} · {doc.approved_by || 'System'}
                          </div>
                          <div className="ml-6 w-16">
                            {/* Confidence Indicator */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5 flex overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full ${doc.confidence > 0.85 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                style={{ width: `${(doc.confidence * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default RepositoryPanel;
