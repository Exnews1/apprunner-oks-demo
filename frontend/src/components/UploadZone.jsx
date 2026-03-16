import React, { useState, useRef } from 'react';
import { Upload, FileUp, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const SAMPLE_DOCS = {
  quick: [
    'Meridian_Data_Governance_Policy_v2.1.pdf',
    'Meridian_Knowledge_Taxonomy_SOP.pdf',
    'Meridian_New_Employee_KMS_Training_Guide.txt',
    'Meridian_Memo_AI_Document_Intelligence_Pilot.txt',
    // We duplicate 4 more to make 8 for the quick demo since we only have 4 physical files in the root
    // It will process them again through the pipeline uniquely.
    'Meridian_Data_Governance_Policy_v2.1.pdf',
    'Meridian_Knowledge_Taxonomy_SOP.pdf',
    'Meridian_New_Employee_KMS_Training_Guide.txt',
    'Meridian_Memo_AI_Document_Intelligence_Pilot.txt'
  ],
  full: [] // Would map to all 32. For demo purposes, we will mock the array structure. Let's just create an array of 32 iterations of the 4 files.
};

// Generate 32 sample iterations based on the 4 base files provided by the user instructions
for(let i=0; i<8; i++) {
  SAMPLE_DOCS.full.push(
    'Meridian_Data_Governance_Policy_v2.1.pdf',
    'Meridian_Knowledge_Taxonomy_SOP.pdf',
    'Meridian_New_Employee_KMS_Training_Guide.txt',
    'Meridian_Memo_AI_Document_Intelligence_Pilot.txt'
  );
}

const UploadZone = ({ sessionId, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  // Iterative upload function used by multi-file select
  const processFiles = async (files) => {
    setIsUploading(true);
    setProgress({ current: 0, total: files.length });
    setError('');
    setLastResult(null);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('document', file);

      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'x-session-id': sessionId },
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          setLastResult(data.data); // show latest extracted classification
          successCount++;
          onUploadSuccess();
        } else {
          setError(`Error classifying ${file.name}: ${data.error}`);
        }
      } catch (err) {
        setError(`Network failure on ${file.name}`);
      }
      setProgress({ current: i + 1, total: files.length });
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = ''; // reset
  };

  // Iterative simulation for pre-baked files using fetch to grab the blob first
  // Note: The user explicitly demanded we send them OVER the wire via POST /api/documents/upload
  const loadSamples = async (type) => {
    const list = SAMPLE_DOCS[type];
    setIsUploading(true);
    setProgress({ current: 0, total: list.length });
    setError('');
    setLastResult(null);

    for (let i = 0; i < list.length; i++) {
      const filename = list[i];
      try {
        // In a real deployed environment, these are in the public folder or served via express static at the root
        // If they are in the project root /Documents, we will serve them statically later
        const docRes = await fetch(`/documents/${filename}`); 
        if (!docRes.ok) {
           console.error(`Missing sample document: ${filename}`);
           continue; 
        }
        const blob = await docRes.blob();
        
        const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
        const formData = new FormData();
        formData.append('document', file);

        const uploadRes = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'x-session-id': sessionId },
          body: formData
        });

        const data = await uploadRes.json();
        if (data.success) {
          setLastResult(data.data);
          onUploadSuccess();
        } else {
          setError(`Simulation error: ${data.error}`);
        }
      } catch (err) {
        console.error(err);
      }
      setProgress({ current: i + 1, total: list.length });
    }
    setIsUploading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      
      {/* File Drop Area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={`mx-auto h-10 w-10 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700">Drag & drop documents here</p>
        <p className="text-xs text-gray-500 mt-1">Supports PDF, DOCX, TXT up to 10MB</p>
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect}
          accept=".pdf,.docx,.txt"
        />
        <button className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
          Browse Files
        </button>
      </div>

      {/* Progress Bar overlay */}
      {isUploading && (
        <div className="mt-4 p-4 border border-blue-100 bg-blue-50 rounded-lg flex items-center">
          <Loader2 className="animate-spin text-blue-600 mr-3" size={20} />
          <div className="flex-grow">
            <div className="flex justify-between text-xs font-medium text-blue-800 mb-1">
              <span>Processing...</span>
              <span>{progress.current} / {progress.total} Docs</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Latest Result Card View */}
      {lastResult && !isUploading && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start">
            <CheckCircle className="text-emerald-500 mt-0.5 mr-3 shrink-0" size={18} />
            <div>
              <h4 className="text-sm font-semibold text-emerald-900 leading-tight">AI Classification Complete</h4>
              <p className="text-xs text-emerald-700 mt-0.5">{lastResult.original_name}</p>
              
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="block text-gray-500 mb-0.5">Type Match</span>
                  <span className="font-semibold text-gray-900">{lastResult.doc_type}</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="block text-gray-500 mb-0.5">Confidence</span>
                  <span className="font-semibold text-emerald-600">{(lastResult.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-white p-2 text-center rounded border border-emerald-100 col-span-2">
                  <span className="block text-gray-500 mb-0.5">Calculated KMS Identity</span>
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-700">{lastResult.standard_name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Demo Automations */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Simulation Controls</h4>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => loadSamples('quick')}
            disabled={isUploading}
            className="flex items-center justify-center px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 text-sm font-medium rounded shadow-sm disabled:opacity-50 transition-colors"
          >
            <FileUp size={16} className="mr-2" />
            Quick Demo (8)
          </button>
          <button 
            onClick={() => loadSamples('full')}
            disabled={isUploading}
            className="flex items-center justify-center px-4 py-2 bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 text-sm font-medium rounded shadow-sm disabled:opacity-50 transition-colors"
          >
            <FileUp size={16} className="mr-2 opacity-70" />
            Load All (32)
          </button>
        </div>
      </div>

    </div>
  );
};

export default UploadZone;
