import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import SignatureCanvas from 'react-signature-canvas';
import { CheckCircle2, Loader2, Download, Copy, Check, PenTool, X, ChevronDown, ChevronUp, FileText, Globe, Sparkles } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const CopyField = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
      <div className="min-w-0 pr-2">
        <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className="p-2 rounded-lg transition-colors hover:bg-gray-50 text-gray-500 hover:text-gray-900 flex-shrink-0 cursor-pointer"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
      </button>
    </div>
  );
};

export default function ClientView() {
  const { id } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  
  // Custom HTML Surfer Controls
  const [showSignModal, setShowSignModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  
  const sigCanvas = useRef<SignatureCanvas>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function loadProposal() {
      if (!id) return;
      try {
        const docRef = doc(db, 'proposals', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProposal({ id: docSnap.id, ...data });
          if (data.clientName) {
            document.title = `${data.title || 'Proposal'} - ${data.clientName}`;
          }
        } else {
          setError('Proposal not found.');
        }
      } catch (err) {
        console.error(err);
        setError('Error loading proposal.');
      } finally {
        setLoading(false);
      }
    }
    loadProposal();
  }, [id]);

  // Listen to messages from the custom HTML iframe if any button triggers signing
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_SIGN_MODAL' || event.data?.action === 'sign') {
        setShowSignModal(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Dynamically load Google Font for standard document view
  useEffect(() => {
    if (!proposal?.isCustomHtml && proposal?.brandKit?.fontFamily) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${proposal.brandKit.fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, [proposal?.isCustomHtml, proposal?.brandKit?.fontFamily]);

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
    setHasSignature(false);
  };

  const handleApprove = async () => {
    if (!hasSignature) {
      alert("Please provide a signature to approve the proposal.");
      return;
    }

    setSigning(true);
    try {
      const signatureDataUrl = sigCanvas.current?.getCanvas().toDataURL('image/png');
      
      await updateDoc(doc(db, 'proposals', id!), {
        status: 'approved',
        signature: signatureDataUrl,
        updatedAt: serverTimestamp()
      });
      
      // Create notification for the owner
      await addDoc(collection(db, 'notifications'), {
        ownerId: proposal.ownerId,
        proposalId: id,
        proposalTitle: proposal.title || 'Untitled Proposal',
        clientName: proposal.clientName || 'Client',
        message: `${proposal.clientName || 'Client'} has signed and approved the proposal: ${proposal.title || 'Untitled Proposal'}`,
        read: false,
        createdAt: serverTimestamp()
      });

      setProposal({ ...proposal, status: 'approved', signature: signatureDataUrl });
      setShowSignModal(false);
      setShowPaymentModal(true);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to submit approval: ${err.message || 'Unknown error'}`);
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!proposal) return;
    
    if (proposal.isCustomHtml) {
      // For custom HTML proposals, print or export the exact page
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(proposal.content || '');
        if (proposal.status === 'approved' && proposal.signature) {
          printWindow.document.write(`
            <div style="margin-top: 40px; padding: 24px; border-top: 2px solid #e5e7eb; font-family: sans-serif;">
              <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #111;">Client Digital Approval</h3>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;">Signed by: <strong>${proposal.clientName}</strong></p>
              <img src="${proposal.signature}" style="max-height: 80px; display: block;" />
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

    const brandKit = proposal.brandKit || {
      primary: '#0A271C',
      secondary: '#62FFB2',
      accent: '#1A6349',
      background: '#EAF3EB',
      text: '#1A6349',
      fontFamily: 'Plus Jakarta Sans'
    };

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
          color: ${brandKit.text};
          font-family: "${brandKit.fontFamily}", sans-serif;
          font-size: 16px;
          line-height: 1.7;
        }
        .branded-prose h1, .branded-prose h2, .branded-prose h3, .branded-prose h4, .branded-prose h5, .branded-prose h6 {
          font-family: "${brandKit.fontFamily}", sans-serif;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .branded-prose h1, .branded-prose h2 {
          color: ${brandKit.primary};
        }
        .branded-prose h3, .branded-prose h4 {
          color: ${brandKit.secondary};
        }
        .branded-prose h1 { font-size: 2.25rem; }
        .branded-prose h2 { font-size: 1.875rem; }
        .branded-prose h3 { font-size: 1.5rem; }
        .branded-prose em {
          font-style: italic;
          color: ${brandKit.secondary};
        }
        .branded-prose strong {
          color: ${brandKit.primary};
          font-weight: 700;
        }
        .branded-prose code, .branded-prose pre {
          font-family: monospace;
        }
        .branded-prose ul {
          list-style-type: square;
          padding-left: 1.5rem;
        }
        .branded-prose li::marker {
          color: ${brandKit.accent};
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
          ${proposal.logo ? `<img src="${proposal.logo}" style="height: 48px; object-fit: contain;" />` : ''}
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: ${brandKit.primary}; font-family: '${brandKit.fontFamily}', sans-serif;">${proposal.title || 'Project Proposal'}</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: ${brandKit.text}; font-family: '${brandKit.fontFamily}', sans-serif;">Prepared for: <strong>${proposal.clientName}</strong></p>
          </div>
        </div>
        <div class="prose branded-prose" style="max-width: none;">
          ${proposal.content}
        </div>
        ${proposal.status === 'approved' && proposal.signature ? `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <h3 style="color: ${brandKit.primary}; margin-bottom: 16px; font-family: '${brandKit.fontFamily}', sans-serif;">Client Approval</h3>
            <p style="color: ${brandKit.text}; font-size: 14px; margin-bottom: 8px; font-family: '${brandKit.fontFamily}', sans-serif;">Digitally signed by ${proposal.clientName}</p>
            <img src="${proposal.signature}" style="max-height: 80px;" />
          </div>
        ` : ''}
      </div>
    `;
    
    const opt: any = {
      margin:       0,
      filename:     `${proposal.title || 'Proposal'}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: brandKit.background, windowWidth: 816 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Proposal Not Available</h2>
          <p className="text-gray-600 text-sm mb-6">{error || 'This proposal link might be expired or invalid.'}</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. CUSTOM HTML WEBPAGE SURFER EXPERIENCE (100% UNMODIFIED EXACT WEBPAGE)
  // =========================================================================
  if (proposal.isCustomHtml) {
    // Inject tiny helper into the iframe so any link with #sign or data-sign triggers sign modal
    const enrichedHtml = `
      <!DOCTYPE html>
      ${proposal.content.includes('<html') ? proposal.content : `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${proposal.title || 'Proposal'}</title></head><body>${proposal.content}</body></html>`}
      <script>
        document.addEventListener('click', function(e) {
          var target = e.target.closest('a, button');
          if (target) {
            var href = target.getAttribute('href');
            var dataSign = target.getAttribute('data-sign');
            if (href === '#sign' || href === '#approve' || dataSign === 'true') {
              e.preventDefault();
              window.parent.postMessage({ type: 'OPEN_SIGN_MODAL' }, '*');
            }
          }
        });
        window.openSignModal = function() {
          window.parent.postMessage({ type: 'OPEN_SIGN_MODAL' }, '*');
        };
      </script>
    `;

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-white font-sans">
        {/* Full-bleed interactive Webpage Frame */}
        <iframe
          ref={iframeRef}
          srcDoc={enrichedHtml}
          title={proposal.title || 'Proposal Webpage'}
          className="w-full h-full border-0 absolute inset-0 z-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />

        {/* Floating Approval & Surfing Navigation Dock (Bottom Overlay) */}
        {!isDockMinimized ? (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="bg-gray-950/90 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Proposal Info */}
              <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-amber-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate text-white">{proposal.title || 'Proposal Webpage'}</h3>
                    {proposal.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Signed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Pending Sign
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    Prepared for <span className="text-gray-200 font-medium">{proposal.clientName || 'Valued Client'}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Print / Save PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export PDF</span>
                </button>

                {proposal.status === 'approved' ? (
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>View Approval & Bank Details</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSignModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-semibold text-gray-950 transition-all shadow-md flex items-center gap-1.5 cursor-pointer animate-pulse hover:animate-none"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Sign & Approve Proposal</span>
                  </button>
                )}

                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => setIsDockMinimized(true)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimize Dock"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        ) : (
          /* Minimized Floating Capsule Button */
          <div className="fixed bottom-6 right-6 z-30 animate-in fade-in zoom-in duration-150">
            <button
              type="button"
              onClick={() => setIsDockMinimized(false)}
              className="bg-gray-950/95 text-white backdrop-blur-md px-4 py-3 rounded-full shadow-2xl border border-white/20 flex items-center gap-2 hover:bg-black transition-all cursor-pointer group"
            >
              {proposal.status === 'approved' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium">Proposal Approved</span>
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-semibold">Review & Sign Proposal</span>
                </>
              )}
              <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
            </button>
          </div>
        )}

        {/* Digital Signature Modal */}
        {showSignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Approve & Sign Proposal</h3>
                    <p className="text-xs text-gray-500">Proposal for {proposal.clientName || 'Client'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSignModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                By providing your digital signature below, you accept the scope of work, deliverables, and terms presented on this proposal webpage.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Draw Signature
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50/50">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-40 cursor-crosshair' }}
                    onEnd={() => setHasSignature(true)}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] text-gray-400">Sign using mouse, touch screen, or stylus</span>
                  <button
                    type="button"
                    onClick={handleClearSignature}
                    className="text-xs text-gray-500 hover:text-gray-900 font-medium underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-xs transition-colors"
                >
                  Back to Webpage
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={signing || !hasSignature}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
                >
                  {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {signing ? 'Submitting Signature...' : 'Confirm & Sign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval & Bank Details Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6">
              
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Proposal Approved</h3>
                    <p className="text-xs text-gray-500">Thank you for approving this project proposal.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Signature Display */}
              {proposal.signature && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Verified Digital Signature</p>
                  <div className="bg-white p-3 rounded-lg border border-gray-200 inline-block">
                    <img src={proposal.signature} alt="Client Signature" className="max-h-20 object-contain" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Signed by: <strong className="text-gray-800">{proposal.clientName}</strong></p>
                </div>
              )}

              {/* Payment Details */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Payment & Wire Transfer Details</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Please use the following account details to complete the payment for this proposal:</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyField label="Account Name" value="Ali Amin" />
                  <CopyField label="IBAN" value="PK56ABPA0010111635410010" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Return to Webpage
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // =========================================================================
  // 2. STANDARD DOCUMENT PROPOSAL EXPERIENCE (FOR AI & VISUAL CREATIONS)
  // =========================================================================
  const brandKit = proposal.brandKit || {
    primary: '#e38c35',
    secondary: '#6e77cb',
    accent: '#1a1a1a',
    background: '#f5f1e8',
    text: '#1a1a1a',
    fontFamily: 'Plus Jakarta Sans'
  };

  return (
    <div 
      className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" 
      style={{ backgroundColor: brandKit.background, fontFamily: `"${brandKit.fontFamily}", sans-serif` }}
    >
      <style>{`
        .branded-prose {
          color: ${brandKit.text};
          font-family: "${brandKit.fontFamily}", sans-serif;
        }
        .branded-prose h1, .branded-prose h2, .branded-prose h3, .branded-prose h4, .branded-prose h5, .branded-prose h6 {
          font-family: "${brandKit.fontFamily}", sans-serif;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .branded-prose h1, .branded-prose h2 {
          color: ${brandKit.primary};
        }
        .branded-prose h3, .branded-prose h4 {
          color: ${brandKit.secondary};
        }
        .branded-prose h1 { font-size: 2.25rem; }
        .branded-prose h2 { font-size: 1.875rem; }
        .branded-prose h3 { font-size: 1.5rem; }
        .branded-prose em {
          font-style: italic;
          color: ${brandKit.secondary};
        }
        .branded-prose strong {
          color: ${brandKit.primary};
          font-weight: 700;
        }
        .branded-prose code, .branded-prose pre {
          font-family: monospace;
        }
        .branded-prose ul {
          list-style-type: square;
          padding-left: 1.5rem;
        }
        .branded-prose li::marker {
          color: ${brandKit.accent};
        }
        .branded-prose p {
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .branded-prose a {
          color: ${brandKit.accent};
          text-decoration: underline;
        }
      `}</style>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full md:w-auto">
            {proposal.logo && (
              <img src={proposal.logo} alt="Company Logo" className="max-h-20 max-w-[200px] sm:max-w-[250px] object-contain flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0 break-words">
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight" style={{ color: brandKit.primary }}>{proposal.title || 'Project Proposal'}</h1>
              <p className="text-sm mt-2" style={{ color: brandKit.text }}>Prepared for: <span className="font-medium">{proposal.clientName}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0 flex-shrink-0">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            {proposal.status === 'approved' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-700 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                Pending Review
              </span>
            )}
          </div>
        </div>

        {/* Proposal Content */}
        <div 
          id="proposal-content"
          className="bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-gray-200 prose branded-prose max-w-none"
          style={{ color: brandKit.text }}
          dangerouslySetInnerHTML={{ __html: proposal.content || '<p>No content available.</p>' }}
        />

        {/* Signature Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-6" style={{ color: brandKit.primary }}>Client Approval</h2>
          
          {proposal.status === 'approved' && proposal.signature ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: brandKit.primary }} />
                <div>
                  <h3 className="font-medium" style={{ color: brandKit.primary }}>Proposal Approved</h3>
                  <p className="text-sm mt-1" style={{ color: brandKit.text }}>This proposal has been signed and approved.</p>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm font-medium mb-2" style={{ color: brandKit.text }}>Digital Signature:</p>
                <div className="border border-gray-200 rounded-xl p-4 bg-white inline-block shadow-sm">
                  <img src={proposal.signature} alt="Client Signature" className="max-h-32" />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-1" style={{ color: brandKit.primary }}>Payment Details</h3>
                <p className="text-sm mb-4" style={{ color: brandKit.text }}>Please use the following bank details to process the payment for this project.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CopyField label="Account Name" value="Ali Amin" />
                  <CopyField label="IBAN" value="PK56ABPA0010111635410010" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm" style={{ color: brandKit.text }}>
                By signing below, you agree to the terms and scope of work outlined in this proposal.
              </p>
              
              <div>
                <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-48 cursor-crosshair' }}
                    onEnd={() => setHasSignature(true)}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <button 
                    onClick={handleClearSignature}
                    className="text-sm hover:opacity-70 font-medium transition-opacity cursor-pointer"
                    style={{ color: brandKit.text }}
                  >
                    Clear Signature
                  </button>
                </div>
              </div>

              <button
                onClick={handleApprove}
                disabled={signing}
                style={{ backgroundColor: brandKit.primary }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-50 cursor-pointer"
              >
                {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {signing ? 'Submitting...' : 'Sign & Approve'}
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
