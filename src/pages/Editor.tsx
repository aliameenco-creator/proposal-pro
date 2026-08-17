import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { 
  Save, Send, Download, Sparkles, ArrowLeft, Loader2, Check, X, Copy, 
  Upload, FileCode, Code, Eye, LayoutTemplate, Globe, Smartphone, Tablet, 
  Monitor, ExternalLink, RefreshCw 
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { cn } from '../lib/utils';
import UploadHtmlModal from '../components/UploadHtmlModal';
import { parseUploadedHtml } from '../lib/htmlHelper';

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [status, setStatus] = useState<'draft' | 'sent' | 'approved'>('draft');
  const [logo, setLogo] = useState('');
  const [signature, setSignature] = useState('');
  const [isCustomHtml, setIsCustomHtml] = useState(false);
  const [editorTab, setEditorTab] = useState<'surfer' | 'code' | 'visual'>('visual');
  const [htmlContent, setHtmlContent] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  
  const [brandProfiles, setBrandProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [brandKit, setBrandKit] = useState({
    primary: '#e38c35',
    secondary: '#6e77cb',
    accent: '#1a1a1a',
    background: '#f5f1e8',
    text: '#1a1a1a',
    fontFamily: 'Plus Jakarta Sans'
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Diagram Editing State
  const [selectedDiagram, setSelectedDiagram] = useState<{src: string, pos: number} | null>(null);
  const [diagramPrompt, setDiagramPrompt] = useState('');
  const [isEditingDiagram, setIsEditingDiagram] = useState(false);

  // Send Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMsg, setSendMsg] = useState('Hi, here is the proposal for your review.');
  const [copied, setCopied] = useState(false);
  
  const proposalLink = `${window.location.origin}/client/${id}`;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[500px] p-8 branded-prose',
      },
      handleClickOn: (view, pos, node, nodePos) => {
        if (node.type.name === 'image' && node.attrs.src.startsWith('data:image/svg+xml')) {
          setSelectedDiagram({ src: node.attrs.src, pos: nodePos });
          return true;
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      if (!isCustomHtml) {
        setHtmlContent(editor.getHTML());
      }
    }
  });

  // Dynamically load Google Font for standard document
  useEffect(() => {
    if (!isCustomHtml && brandKit.fontFamily) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${brandKit.fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, [isCustomHtml, brandKit.fontFamily]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      try {
        const settingsRef = doc(db, 'settings', user.id);
        const settingsSnap = await getDoc(settingsRef);
        let profiles: any[] = [];
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.brandProfiles && data.brandProfiles.length > 0) {
            profiles = data.brandProfiles;
          } else if (data.companyName || data.logo || data.brandKit) {
            profiles = [{
              id: 'default',
              name: data.companyName || 'Default Brand',
              logo: data.logo || '',
              brandKit: data.brandKit || brandKit
            }];
          }
          setBrandProfiles(profiles);
        }

        if (id === 'new') {
          if (profiles.length > 0) {
            setSelectedProfileId(profiles[0].id);
            setLogo(profiles[0].logo || '');
            setBrandKit(profiles[0].brandKit);
          }
        } else {
          // Fetch proposal
          const docRef = doc(db, 'proposals', id!);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().ownerId === user.id) {
            const data = docSnap.data();
            setTitle(data.title || '');
            setClientName(data.clientName || '');
            setClientEmail(data.clientEmail || '');
            setProjectDetails(data.projectDetails || '');
            setStatus(data.status || 'draft');
            setLogo(data.logo || '');
            setSignature(data.signature || '');
            const customHtmlMode = !!data.isCustomHtml;
            setIsCustomHtml(customHtmlMode);
            if (data.brandKit) setBrandKit(data.brandKit);
            
            if (data.content) {
              setHtmlContent(data.content);
              if (editor && !customHtmlMode) {
                editor.commands.setContent(data.content);
              }
            }

            if (customHtmlMode) {
              setEditorTab('surfer');
            } else {
              setEditorTab('visual');
            }

            // Try to match the loaded brandKit/logo to an existing profile
            if (profiles.length > 0) {
              const matched = profiles.find(p => p.logo === data.logo && JSON.stringify(p.brandKit) === JSON.stringify(data.brandKit));
              if (matched) {
                setSelectedProfileId(matched.id);
              } else {
                setSelectedProfileId('custom');
              }
            }
          } else {
            navigate('/');
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setInitialLoad(false);
      }
    }
    
    loadData();
  }, [id, user, editor, navigate]);

  const handleGenerate = async () => {
    if (!editor) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, projectDetails, brandKit })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      let generatedHtml = data.text || '';
      generatedHtml = generatedHtml.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').replace(/```xml\n?/i, '').replace(/```svg\n?/i, '');
      
      // Convert SVGs to Base64 Images so Tiptap can render them
      generatedHtml = generatedHtml.replace(/<svg([\s\S]*?)<\/svg>/gi, (match) => {
        try {
          let svgContent = match;
          if (!svgContent.includes('xmlns=')) {
            svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          }
          const encoded = btoa(unescape(encodeURIComponent(svgContent)));
          return `<img src="data:image/svg+xml;base64,${encoded}" alt="Diagram" style="width: 100%; height: auto; margin: 20px 0; border-radius: 8px; display: block;" />`;
        } catch (e) {
          console.error("SVG encoding error", e);
          return match;
        }
      });
      
      setHtmlContent(generatedHtml);
      editor.commands.setContent(generatedHtml);
      setIsCustomHtml(false);
      setEditorTab('visual');
    } catch (error) {
      console.error("Error generating proposal:", error);
      if (error instanceof Error && error.message.includes('Quota')) {
        alert("API Quota exceeded. Please try again later or upgrade your Gemini API plan.");
      } else {
        alert("Failed to generate proposal. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportHtml = (data: { title: string; clientName: string; content: string; isCustomHtml?: boolean }) => {
    if (data.title && (!title || title === 'Untitled Proposal')) {
      setTitle(data.title);
    }
    if (data.clientName && !clientName) {
      setClientName(data.clientName);
    }
    
    setHtmlContent(data.content);
    setIsCustomHtml(true);
    setEditorTab('surfer');
    setIframeKey(k => k + 1);
  };

  const handleEditorTabSwitch = (newTab: 'surfer' | 'code' | 'visual') => {
    if (editorTab === 'code' && newTab === 'visual' && !isCustomHtml) {
      if (editor) {
        editor.commands.setContent(htmlContent);
      }
    } else if (editorTab === 'visual' && newTab !== 'visual' && !isCustomHtml) {
      if (editor) {
        setHtmlContent(editor.getHTML());
      }
    }
    setEditorTab(newTab);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      let currentContent = htmlContent;
      if (!isCustomHtml && editorTab === 'visual' && editor) {
        currentContent = editor.getHTML();
      }
      
      const proposalData: any = {
        title: title || 'Untitled Proposal',
        clientName,
        clientEmail,
        brandKit,
        logo,
        projectDetails,
        content: currentContent,
        isCustomHtml,
        status,
        ownerId: user.id,
        updatedAt: serverTimestamp(),
      };

      if (id === 'new') {
        const newDocRef = doc(collection(db, 'proposals'));
        proposalData.createdAt = serverTimestamp();
        await setDoc(newDocRef, proposalData);
        navigate(`/editor/${newDocRef.id}`, { replace: true });
      } else {
        await updateDoc(doc(db, 'proposals', id!), proposalData);
      }
    } catch (error) {
      console.error("Error saving proposal:", error);
      alert("Failed to save proposal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (!htmlContent) return;

    if (isCustomHtml) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        if (status === 'approved' && signature) {
          printWindow.document.write(`
            <div style="margin-top: 40px; padding: 24px; border-top: 2px solid #e5e7eb; font-family: sans-serif;">
              <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #111;">Client Digital Approval</h3>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;">Signed by: <strong>${clientName}</strong></p>
              <img src="${signature}" style="max-height: 80px; display: block;" />
            </div>
          `);
        }
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      return;
    }
    
    const element = document.createElement('div');
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=${brandKit.fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
        .pdf-container {
          background-color: ${brandKit.background};
          padding: 48px;
          min-height: 1056px;
          font-family: "${brandKit.fontFamily}", sans-serif;
          color: ${brandKit.text};
          width: 816px;
          box-sizing: border-box;
          margin: 0 auto;
        }
        .branded-prose {
          --tw-prose-body: ${brandKit.text};
          --tw-prose-headings: ${brandKit.primary};
          --tw-prose-links: ${brandKit.accent};
          --tw-prose-bold: ${brandKit.primary};
          --tw-prose-bullets: ${brandKit.primary};
          font-family: "${brandKit.fontFamily}", sans-serif;
          font-size: 16px;
          line-height: 1.6;
        }
        .branded-prose h1, .branded-prose h2, .branded-prose h3, .branded-prose h4, .branded-prose strong {
          color: ${brandKit.primary} !important;
        }
        .branded-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        .branded-prose p, .branded-prose li, .branded-prose h1, .branded-prose h2, .branded-prose h3, .branded-prose h4, .branded-prose img, .branded-prose svg {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      </style>
      <div class="pdf-container">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
          ${logo ? `<img src="${logo}" style="height: 48px; object-fit: contain;" />` : ''}
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: ${brandKit.primary}; font-family: '${brandKit.fontFamily}', sans-serif;">${title || 'Project Proposal'}</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: ${brandKit.text}; font-family: '${brandKit.fontFamily}', sans-serif;">Prepared for: <strong>${clientName}</strong></p>
          </div>
        </div>
        <div class="prose branded-prose" style="max-width: none;">
          ${htmlContent}
        </div>
        ${status === 'approved' && signature ? `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; page-break-inside: avoid; break-inside: avoid;">
            <h3 style="color: ${brandKit.primary}; margin-bottom: 16px; font-family: '${brandKit.fontFamily}', sans-serif;">Client Approval</h3>
            <p style="color: ${brandKit.text}; font-size: 14px; margin-bottom: 8px; font-family: '${brandKit.fontFamily}', sans-serif;">Digitally signed by ${clientName}</p>
            <img src="${signature}" style="max-height: 80px;" />
          </div>
        ` : ''}
      </div>
    `;
    
    const opt: any = {
      margin:       0,
      filename:     `${title || 'Proposal'}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: brandKit.background, windowWidth: 816 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleUpdateDiagram = async () => {
    if (!selectedDiagram || !editor) return;
    setIsEditingDiagram(true);
    try {
      let currentSvg = '';
      if (selectedDiagram.src.startsWith('data:image/svg+xml;base64,')) {
        currentSvg = decodeURIComponent(escape(atob(selectedDiagram.src.replace('data:image/svg+xml;base64,', ''))));
      } else {
        throw new Error("Invalid SVG format");
      }

      const response = await fetch('/api/edit-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSvg, diagramPrompt, brandKit })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      let newSvg = data.svg || '';
      newSvg = newSvg.replace(/^```xml\n?/i, '').replace(/^```svg\n?/i, '').replace(/\n?```$/i, '').trim();
      
      if (!newSvg.includes('<svg') || !newSvg.includes('</svg>')) {
        throw new Error("Model failed to generate a valid SVG diagram.");
      }
      
      if (!newSvg.includes('xmlns=')) {
        newSvg = newSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      const encoded = btoa(unescape(encodeURIComponent(newSvg)));
      const newSrc = `data:image/svg+xml;base64,${encoded}`;
      
      editor.chain().focus().setNodeSelection(selectedDiagram.pos).command(({ tr }) => {
        tr.setNodeMarkup(selectedDiagram.pos, undefined, { src: newSrc });
        return true;
      }).run();
      
      setSelectedDiagram(null);
      setDiagramPrompt('');
    } catch (error) {
      console.error("Error updating diagram:", error);
      if (error instanceof Error && error.message.includes('Quota')) {
        alert("API Quota exceeded. Please try again later or upgrade your Gemini API plan.");
      } else {
        alert("Failed to update diagram.");
      }
    } finally {
      setIsEditingDiagram(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(proposalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (status === 'draft') {
        await updateDoc(doc(db, 'proposals', id!), {
          status: 'sent',
          updatedAt: serverTimestamp()
        });
        setStatus('sent');
      }
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleSendEmail = async () => {
    if (id === 'new') {
      alert("Please save the proposal first before sending.");
      return;
    }
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'proposals', id!), {
        status: 'sent',
        clientEmail,
        updatedAt: serverTimestamp()
      });
      setStatus('sent');
      
      const link = `${window.location.origin}/client/${id}`;
      const body = `${sendMsg}\n\nReview and sign here: ${link}`;
      window.location.href = `mailto:${clientEmail}?subject=Proposal from ${user?.displayName || 'us'}&body=${encodeURIComponent(body)}`;
      
      setShowSendModal(false);
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(html|htm)$/i)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const parsed = parseUploadedHtml(text, file.name);
          handleImportHtml({
            title: parsed.title,
            clientName: parsed.clientName,
            content: parsed.content,
            isCustomHtml: true
          });
        };
        reader.readAsText(file);
      }
    }
  };

  if (initialLoad) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 font-sans">
      <style>{`
        .ProseMirror, .branded-prose {
          color: ${brandKit.text};
          font-family: "${brandKit.fontFamily}", sans-serif;
        }
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6,
        .branded-prose h1, .branded-prose h2, .branded-prose h3, .branded-prose h4, .branded-prose h5, .branded-prose h6 {
          font-family: "${brandKit.fontFamily}", sans-serif;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .ProseMirror h1, .branded-prose h1, .ProseMirror h2, .branded-prose h2 {
          color: ${brandKit.primary};
        }
        .ProseMirror h3, .branded-prose h3, .ProseMirror h4, .branded-prose h4 {
          color: ${brandKit.secondary};
        }
        .ProseMirror h1, .branded-prose h1 { font-size: 2.25rem; }
        .ProseMirror h2, .branded-prose h2 { font-size: 1.875rem; }
        .ProseMirror h3, .branded-prose h3 { font-size: 1.5rem; }
        .ProseMirror em, .branded-prose em {
          font-style: italic;
          color: ${brandKit.secondary};
        }
        .ProseMirror strong, .branded-prose strong {
          color: ${brandKit.primary};
          font-weight: 700;
        }
        .ProseMirror code, .branded-prose code, .ProseMirror pre, .branded-prose pre {
          font-family: monospace;
        }
        .ProseMirror ul, .branded-prose ul {
          list-style-type: square;
          padding-left: 1.5rem;
        }
        .ProseMirror li::marker, .branded-prose li::marker {
          color: ${brandKit.accent};
        }
        .ProseMirror p, .branded-prose p {
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .ProseMirror a, .branded-prose a {
          color: ${brandKit.accent};
          text-decoration: underline;
        }
      `}</style>
      
      {/* Sidebar - Controls */}
      <div className="w-full lg:w-80 flex flex-col gap-6 flex-shrink-0">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium w-fit text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* HTML Upload Quick Card */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-5 rounded-2xl text-white shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-gray-200">
            <Globe className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-sm">Upload HTML Webpage</h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Upload an HTML webpage file. Your clients can surf the exact webpage and sign it online.
          </p>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white text-gray-900 rounded-xl font-semibold text-xs hover:bg-gray-100 transition-colors shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {isCustomHtml ? 'Replace HTML File' : 'Upload HTML Webpage'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-lg">Proposal Details</h3>
            {isCustomHtml ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Globe className="w-3 h-3 text-amber-600" /> Webpage Mode
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
                Standard Document
              </span>
            )}
          </div>
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
              placeholder="e.g. Website Redesign"
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Client Name</label>
            <input 
              type="text" 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Project Scope / Notes</label>
            <textarea 
              value={projectDetails}
              onChange={(e) => setProjectDetails(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all h-20 resize-none text-sm"
              placeholder="Brief summary or scope details..."
            />
          </div>

          {!isCustomHtml && (
            <>
              {brandProfiles.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Brand Profile</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProfileId(val);
                      if (val !== 'custom') {
                        const profile = brandProfiles.find(p => p.id === val);
                        if (profile) {
                          setLogo(profile.logo || '');
                          setBrandKit(profile.brandKit);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm bg-white"
                  >
                    {brandProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {selectedProfileId === 'custom' && <option value="custom">Custom (Legacy)</option>}
                  </select>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !clientName}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate with AI'}
              </button>
            </>
          )}

          {isCustomHtml && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-700" />
                Live Webpage Surfing Mode
              </p>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                Clients will navigate this exact HTML page with its full layouts, CSS, and animations, plus a floating signature dock to sign and approve.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-900 text-lg mb-2">Actions</h3>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors text-sm cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Proposal
          </button>

          <button
            onClick={handleExportPDF}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>

          <div className="pt-3 border-t border-gray-100 mt-2">
            <button
              onClick={() => {
                if (id === 'new') {
                  alert('Please save the proposal first before sending.');
                  return;
                }
                setShowSendModal(true);
              }}
              disabled={id === 'new' || isSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors text-sm cursor-pointer disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-4 h-4" />
              Send to Client
            </button>
            {status === 'sent' && (
              <p className="text-xs text-center text-gray-500 mt-2 font-medium">
                Proposal has been marked as sent.
              </p>
            )}
            {status === 'approved' && (
              <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl">
                <p className="text-xs text-center text-green-800 font-semibold mb-2 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Client Approved & Signed!
                </p>
                {signature && (
                  <div className="flex justify-center bg-white p-2 rounded border border-green-100">
                    <img src={signature} alt="Client Signature" className="max-h-12 object-contain" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content & Editor Area */}
      <div 
        className="flex-1 flex flex-col relative min-w-0"
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={handleCanvasDrop}
      >
        {/* Drag Overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-40 bg-gray-900/85 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center text-white p-6 border-2 border-dashed border-white animate-in fade-in">
            <Upload className="w-12 h-12 mb-3 animate-bounce text-amber-400" />
            <h4 className="text-lg font-bold">Drop your HTML webpage file here</h4>
            <p className="text-sm text-gray-300 mt-1">We'll load your complete webpage instantly without changes.</p>
          </div>
        )}

        {/* Top Tab Switcher & Surfing Controls */}
        <div className="bg-white rounded-t-2xl border border-gray-200 border-b-0 p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            {isCustomHtml ? (
              <>
                <button
                  type="button"
                  onClick={() => handleEditorTabSwitch('surfer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    editorTab === 'surfer' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-amber-600" />
                  Live Webpage Surfer
                </button>
                <button
                  type="button"
                  onClick={() => handleEditorTabSwitch('code')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    editorTab === 'code' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  HTML Source Code
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleEditorTabSwitch('visual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    editorTab === 'visual' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Visual Editor
                </button>
                <button
                  type="button"
                  onClick={() => handleEditorTabSwitch('code')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    editorTab === 'code' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  HTML Source Code
                </button>
                <button
                  type="button"
                  onClick={() => handleEditorTabSwitch('surfer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    editorTab === 'surfer' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Client Preview
                </button>
              </>
            )}
          </div>

          {/* Right Controls: Device Preview Switchers & Upload */}
          <div className="flex items-center gap-2">
            {editorTab === 'surfer' && isCustomHtml && (
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Desktop View (100%)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    previewDevice === 'tablet' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Tablet View (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Mobile View (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIframeKey(k => k + 1)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
                  title="Reload Webpage Preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!isCustomHtml && editorTab === 'visual' && (
              <div className="flex gap-1 items-center border-l border-gray-200 pl-2">
                <button onClick={() => editor?.chain().focus().toggleBold().run()} className={cn("p-1.5 px-2 rounded-lg hover:bg-gray-100 text-xs font-bold text-gray-700 cursor-pointer", editor?.isActive('bold') && "bg-gray-200 text-gray-900")}>B</button>
                <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={cn("p-1.5 px-2 rounded-lg hover:bg-gray-100 italic text-xs font-medium text-gray-700 cursor-pointer", editor?.isActive('italic') && "bg-gray-200 text-gray-900")}>I</button>
                <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("p-1.5 px-2 rounded-lg hover:bg-gray-100 font-bold text-xs text-gray-700 cursor-pointer", editor?.isActive('heading', { level: 2 }) && "bg-gray-200 text-gray-900")}>H2</button>
                <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={cn("p-1.5 px-2 rounded-lg hover:bg-gray-100 font-bold text-xs text-gray-700 cursor-pointer", editor?.isActive('heading', { level: 3 }) && "bg-gray-200 text-gray-900")}>H3</button>
                <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={cn("p-1.5 px-2 rounded-lg hover:bg-gray-100 text-xs font-medium text-gray-700 cursor-pointer", editor?.isActive('bulletList') && "bg-gray-200 text-gray-900")}>• List</button>
              </div>
            )}

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload HTML
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div 
          className="border border-gray-200 border-t-0 rounded-b-2xl overflow-hidden flex-1 flex flex-col min-h-[640px] relative bg-gray-100"
        >
          {/* TAB 1: WEBPAGE SURFER / CLIENT PREVIEW */}
          {editorTab === 'surfer' && (
            <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto bg-gray-200/60">
              <div 
                className={`w-full transition-all duration-300 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-300 flex flex-col ${
                  previewDevice === 'mobile' ? 'max-w-[390px] h-[780px]' :
                  previewDevice === 'tablet' ? 'max-w-[768px] h-[850px]' :
                  'max-w-full h-[850px]'
                }`}
              >
                {/* Browser URL Bar Simulation */}
                <div className="bg-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="flex-1 max-w-md bg-white border border-gray-200 rounded-lg px-3 py-1 text-center text-gray-700 font-mono text-[11px] truncate flex items-center justify-center gap-1.5">
                    <Globe className="w-3 h-3 text-gray-400" />
                    <span>{window.location.origin}/client/{id || 'proposal-id'}</span>
                  </div>
                  {id !== 'new' && (
                    <a
                      href={`/client/${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-[11px] font-medium"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Link
                    </a>
                  )}
                </div>

                {/* Surfing Frame */}
                <div className="relative flex-1 bg-white">
                  {htmlContent ? (
                    <iframe
                      key={iframeKey}
                      srcDoc={htmlContent}
                      title="Webpage Surfer Preview"
                      className="w-full h-full border-0 bg-white"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-3">
                      <Globe className="w-12 h-12 text-gray-400 stroke-1" />
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">No HTML Webpage Loaded</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm">
                          Upload an HTML file or paste your webpage markup in the HTML Source Code tab to surf it here.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
                      >
                        Upload HTML File
                      </button>
                    </div>
                  )}

                  {/* Simulated Floating Sign Dock in Preview */}
                  {htmlContent && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-lg pointer-events-none">
                      <div className="bg-gray-950/90 text-white backdrop-blur-md rounded-2xl shadow-xl border border-white/10 p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="truncate">
                          <p className="font-semibold truncate text-white">{title || 'Proposal Webpage'}</p>
                          <p className="text-[10px] text-gray-400">For {clientName || 'Client'}</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 font-bold text-[11px] shadow-sm flex items-center gap-1">
                          Sign & Approve
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DIRECT HTML SOURCE CODE */}
          {editorTab === 'code' && (
            <div className="flex-1 flex flex-col bg-gray-950 text-gray-100 font-mono text-xs">
              <div className="px-5 py-2.5 bg-black/60 border-b border-gray-800 flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber-400" />
                  Exact HTML Webpage Markup
                </span>
                <span>{htmlContent.length.toLocaleString()} characters</span>
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="flex-1 w-full p-6 bg-transparent text-gray-100 font-mono text-xs sm:text-sm leading-relaxed outline-none resize-none overflow-y-auto"
                placeholder="<!DOCTYPE html><html><head>...</head><body><h1>Your proposal webpage</h1></body></html>"
                spellCheck={false}
              />
            </div>
          )}

          {/* TAB 3: STANDARD TIPTAP VISUAL EDITOR */}
          {editorTab === 'visual' && !isCustomHtml && (
            <div className="flex-1 overflow-y-auto bg-white" style={{ backgroundColor: brandKit.background }}>
              <EditorContent editor={editor} />
            </div>
          )}

        </div>
      </div>

      {/* Upload HTML Modal */}
      <UploadHtmlModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImport={handleImportHtml}
      />

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Share Proposal</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Proposal Link</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly
                  value={proposalLink}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-gray-600 text-sm outline-none"
                />
                <button 
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm flex items-center gap-2 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Share this link directly with your client to surf and sign.</p>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-xs text-gray-500 uppercase font-medium">Or send via email</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
              <input 
                type="email" 
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
                placeholder="client@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea 
                value={sendMsg}
                onChange={(e) => setSendMsg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all h-24 resize-none text-sm"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button 
                onClick={() => setShowSendModal(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={handleSendEmail}
                disabled={!clientEmail || isSaving}
                className="flex-1 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-black disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Open Email App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagram Edit Modal */}
      {selectedDiagram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Diagram</h3>
              <button onClick={() => setSelectedDiagram(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Describe how you want to change this diagram (e.g., "Change the circle to a square", "Make the text larger").
            </p>
            <textarea
              value={diagramPrompt}
              onChange={(e) => setDiagramPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all h-24 resize-none text-sm mb-4"
              placeholder="Enter your changes..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedDiagram(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDiagram}
                disabled={isEditingDiagram || !diagramPrompt}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black disabled:bg-gray-300 rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isEditingDiagram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isEditingDiagram ? 'Updating...' : 'Update Diagram'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
