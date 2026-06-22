import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { GoogleGenAI } from '@google/genai';
import { Save, Send, Download, Sparkles, ArrowLeft, Loader2, Check, X, Copy } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { cn } from '../lib/utils';

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [status, setStatus] = useState<'draft' | 'sent' | 'approved'>('draft');
  const [logo, setLogo] = useState('');
  const [signature, setSignature] = useState('');
  
  const [brandProfiles, setBrandProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [brandKit, setBrandKit] = useState({
    primary: '#0A271C',
    secondary: '#62FFB2',
    accent: '#1A6349',
    background: '#EAF3EB',
    text: '#1A6349',
    fontFamily: 'Questrial'
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
  const [clientEmail, setClientEmail] = useState('');
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
      handleClickOn: (view, pos, node, nodePos, event, direct) => {
        if (node.type.name === 'image' && node.attrs.src.startsWith('data:image/svg+xml')) {
          setSelectedDiagram({ src: node.attrs.src, pos: nodePos });
          return true;
        }
        return false;
      }
    },
  });

  // Dynamically load Google Font
  useEffect(() => {
    if (brandKit.fontFamily) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${brandKit.fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); }
    }
  }, [brandKit.fontFamily]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      try {
        const settingsRef = doc(db, 'settings', user.uid);
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
          
          if (docSnap.exists() && docSnap.data().ownerId === user.uid) {
            const data = docSnap.data();
            setTitle(data.title || '');
            setClientName(data.clientName || '');
            setClientEmail(data.clientEmail || '');
            setProjectDetails(data.projectDetails || '');
            setStatus(data.status || 'draft');
            setLogo(data.logo || '');
            setSignature(data.signature || '');
            if (data.brandKit) setBrandKit(data.brandKit);
            
            // Try to match the loaded brandKit/logo to an existing profile
            if (profiles.length > 0) {
              const matched = profiles.find(p => p.logo === data.logo && JSON.stringify(p.brandKit) === JSON.stringify(data.brandKit));
              if (matched) {
                setSelectedProfileId(matched.id);
              } else {
                setSelectedProfileId('custom');
              }
            }

            if (editor && data.content) {
              editor.commands.setContent(data.content);
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        Generate a highly concise, professional business proposal for client: ${clientName}.
        Project Details: ${projectDetails}
        
        CRITICAL INSTRUCTIONS:
        1. Focus strictly on deliverables, value proposition, and clear outcomes. Be to-the-point.
        2. Format the output in clean HTML suitable for a rich text editor.
        3. Include sections: Executive Summary, Scope of Work, Deliverables, Timeline, Pricing, and Terms.
        4. Use bullet points and bold text for readability.
        5. MUST INCLUDE VISUALS: Inject clean, modern inline SVG diagrams (e.g., a timeline, process flow, or architecture diagram) to make it visually appealing.
           - CRITICAL: Every <svg> tag MUST include xmlns="http://www.w3.org/2000/svg", a valid viewBox, AND explicit width and height attributes (e.g., width="100%" height="300").
           - CRITICAL: Do NOT use CSS classes or currentColor. Use explicit hex codes for fill and stroke (e.g., fill="${brandKit.primary}").
           - Make the SVGs responsive.
        6. BRANDING: Apply the following Design System using inline styles:
           - Primary Color: ${brandKit.primary} (use for main headings and key SVG elements)
           - Secondary Color: ${brandKit.secondary} (use for highlights/glows)
           - Accent Color: ${brandKit.accent} (use for emphasis)
           - Text Color: ${brandKit.text} (use for body text)
           - Background Color: ${brandKit.background} (use for section backgrounds or SVG backgrounds)
           - Font Family: '${brandKit.fontFamily}', sans-serif
        7. Do NOT wrap the output in markdown code blocks, just return raw HTML.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      let htmlContent = response.text || '';
      htmlContent = htmlContent.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').replace(/```xml\n?/i, '').replace(/```svg\n?/i, '');
      
      // Convert SVGs to Base64 Images so Tiptap can render them
      htmlContent = htmlContent.replace(/<svg([\s\S]*?)<\/svg>/gi, (match) => {
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
      
      editor.commands.setContent(htmlContent);
    } catch (error) {
      console.error("Error generating proposal:", error);
      alert("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!user || !editor) return;
    setIsSaving(true);
    
    try {
      const proposalData: any = {
        title,
        clientName,
        clientEmail,
        brandKit,
        logo,
        projectDetails,
        content: editor.getHTML(),
        status,
        ownerId: user.uid,
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
    if (!editor) return;
    
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
        /* Prevent text and elements from cutting across pages */
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
          ${editor.getHTML()}
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
    
    const opt = {
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const decodedSvg = decodeURIComponent(escape(atob(selectedDiagram.src.split(',')[1])));
      
      const prompt = `
        You are an expert SVG designer. 
        Here is an existing SVG diagram:
        ${decodedSvg}
        
        The user wants to make the following changes:
        "${diagramPrompt}"
        
        CRITICAL INSTRUCTIONS:
        1. Return ONLY the raw updated <svg> code. Do not include any markdown formatting or explanations.
        2. Ensure the <svg> tag includes xmlns="http://www.w3.org/2000/svg", a viewBox, and explicit width/height.
        3. Use explicit hex colors matching the brand: Primary ${brandKit.primary}, Secondary ${brandKit.secondary}, Accent ${brandKit.accent}.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });
      
      let newSvg = response.text || '';
      newSvg = newSvg.replace(/^```(html|xml|svg)?\n?/i, '').replace(/\n?```$/i, '').trim();
      
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
      alert("Failed to update diagram.");
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

  if (initialLoad) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 font-sans">
      <style>{`
        .branded-prose {
          --tw-prose-body: ${brandKit.text};
          --tw-prose-headings: ${brandKit.primary};
          --tw-prose-links: ${brandKit.accent};
          --tw-prose-bold: ${brandKit.primary};
          --tw-prose-bullets: ${brandKit.primary};
          color: ${brandKit.text};
          font-family: "${brandKit.fontFamily}", sans-serif;
        }
        .branded-prose h1, .branded-prose h2, .branded-prose h3, .branded-prose h4, .branded-prose strong {
          color: ${brandKit.primary};
        }
        .branded-prose a {
          color: ${brandKit.accent};
        }
      `}</style>
      
      {/* Sidebar - Controls */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium w-fit text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Proposal Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
              placeholder="e.g. Website Redesign"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
            <input 
              type="text" 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Details</label>
            <textarea 
              value={projectDetails}
              onChange={(e) => setProjectDetails(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all h-24 resize-none text-sm"
              placeholder="Briefly describe the project scope..."
            />
          </div>

          {brandProfiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Profile</label>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors text-sm"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-900 text-lg mb-2">Actions</h3>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors text-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>

          <button
            onClick={handleExportPDF}
            className="w-full flex items-center justify-center gap-2 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>

          <div className="pt-3 border-t border-gray-100 mt-2">
            <button
              onClick={() => {
                if (id === 'new') {
                  alert('Please save the proposal first.');
                  return;
                }
                setShowSendModal(true);
              }}
              disabled={id === 'new' || isSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors text-sm"
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
                <p className="text-xs text-center text-green-800 font-medium mb-2">
                  Client has approved and signed!
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

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white rounded-t-2xl border border-gray-200 border-b-0 p-3 flex gap-2 overflow-x-auto">
          <button onClick={() => editor?.chain().focus().toggleBold().run()} className={cn("p-2 rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-700", editor?.isActive('bold') && "bg-gray-100 text-gray-900")}>B</button>
          <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={cn("p-2 rounded-lg hover:bg-gray-100 italic text-sm font-medium text-gray-700", editor?.isActive('italic') && "bg-gray-100 text-gray-900")}>I</button>
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("p-2 rounded-lg hover:bg-gray-100 font-bold text-sm text-gray-700", editor?.isActive('heading', { level: 2 }) && "bg-gray-100 text-gray-900")}>H2</button>
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={cn("p-2 rounded-lg hover:bg-gray-100 font-bold text-sm text-gray-700", editor?.isActive('heading', { level: 3 }) && "bg-gray-100 text-gray-900")}>H3</button>
          <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={cn("p-2 rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-700", editor?.isActive('bulletList') && "bg-gray-100 text-gray-900")}>• List</button>
        </div>
        <div 
          className="border border-gray-200 border-t-0 rounded-b-2xl overflow-hidden flex-1"
          style={{ backgroundColor: brandKit.background }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

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
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Share this link directly with your client.</p>
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
                className="flex-1 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-black disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
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
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black disabled:bg-gray-300 rounded-xl transition-colors flex items-center gap-2"
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
