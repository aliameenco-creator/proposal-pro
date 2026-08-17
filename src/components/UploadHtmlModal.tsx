import { useState, useRef } from 'react';
import { parseUploadedHtml } from '../lib/htmlHelper';
import { Upload, FileCode, CheckCircle, AlertCircle, X, Sparkles, Eye, Code } from 'lucide-react';

interface UploadHtmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { title: string; clientName: string; content: string; isCustomHtml?: boolean }) => void;
}

export default function UploadHtmlModal({ isOpen, onClose, onImport }: UploadHtmlModalProps) {
  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [fileName, setFileName] = useState('');
  const [rawHtml, setRawHtml] = useState('');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(html|htm)$/i)) {
      setError('Please upload a valid .html or .htm file.');
      return;
    }
    
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawHtml(text);
      
      const parsed = parseUploadedHtml(text, file.name);
      setTitle(parsed.title);
      if (parsed.clientName) setClientName(parsed.clientName);
      setPreviewContent(parsed.content);
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setRawHtml(text);
    if (text.trim()) {
      const parsed = parseUploadedHtml(text);
      if (!title || title === 'Uploaded Proposal') {
        setTitle(parsed.title || 'Custom HTML Proposal');
      }
      if (parsed.clientName && !clientName) {
        setClientName(parsed.clientName);
      }
      setPreviewContent(parsed.content);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawHtml.trim()) {
      setError('Please select an HTML file or paste your HTML code.');
      return;
    }

    const parsed = parseUploadedHtml(rawHtml, fileName);
    onImport({
      title: title.trim() || parsed.title || 'Untitled Proposal',
      clientName: clientName.trim(),
      content: previewContent || parsed.content,
      isCustomHtml: true
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-800">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Upload HTML Proposal</h2>
              <p className="text-xs text-gray-500">Import your custom HTML page or template to send as a client proposal.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Tab selector */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setTab('upload'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'upload' 
                  ? 'bg-white text-gray-900 shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload .html File
            </button>
            <button
              type="button"
              onClick={() => { setTab('paste'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'paste' 
                  ? 'bg-white text-gray-900 shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code className="w-4 h-4" />
              Paste Raw HTML
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'upload' ? (
            <div>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".html,.htm" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
                className="hidden" 
              />
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-gray-900 bg-gray-50/80 scale-[0.99]' 
                    : fileName 
                      ? 'border-green-500/50 bg-green-50/20' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-700">
                  <Upload className="w-6 h-6" />
                </div>
                {fileName ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      {fileName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Click or drop another file to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-900">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-500 mt-1">HTML files (.html, .htm)</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Raw HTML Content
              </label>
              <textarea
                value={rawHtml}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder="<!DOCTYPE html><html><body><h1>Proposal Title</h1>...</body></html>"
                className="w-full h-40 p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all resize-none"
              />
            </div>
          )}

          {/* Proposal Details Form */}
          {rawHtml && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Proposal Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Website Redesign Proposal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Preview Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPreview ? 'Hide HTML Preview' : 'Preview Extracted Proposal HTML'}
                </button>

                {showPreview && (
                  <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-xl max-h-48 overflow-y-auto text-sm">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewContent || rawHtml }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!rawHtml.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Import as Proposal
          </button>
        </div>

      </div>
    </div>
  );
}
