import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import SignatureCanvas from 'react-signature-canvas';
import { FileText, CheckCircle2, Loader2, Download, Copy, Check } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const CopyField = ({ label, value }: { label: string, value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="min-w-0 pr-2">
        <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className="p-2 rounded-lg transition-colors hover:bg-gray-50 text-gray-500 hover:text-gray-900 flex-shrink-0"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
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
  const sigCanvas = useRef<SignatureCanvas>(null);

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
            document.title = `${data.clientName} - Proposal Pro`;
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

  // Dynamically load Google Font
  useEffect(() => {
    if (proposal?.brandKit?.fontFamily) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${proposal.brandKit.fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); }
    }
  }, [proposal?.brandKit?.fontFamily]);

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
        proposalTitle: proposal.title,
        clientName: proposal.clientName,
        message: `${proposal.clientName} has signed and approved the proposal: ${proposal.title}`,
        read: false,
        createdAt: serverTimestamp()
      });

      setProposal({ ...proposal, status: 'approved', signature: signatureDataUrl });
    } catch (err: any) {
      console.error(err);
      alert(`Failed to submit approval: ${err.message || 'Unknown error'}`);
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!proposal) return;
    
    const brandKit = proposal.brandKit || {
      primary: '#0A271C',
      secondary: '#62FFB2',
      accent: '#1A6349',
      background: '#EAF3EB',
      text: '#1A6349',
      fontFamily: 'Questrial'
    };

    const element = document.createElement('div');
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=${brandKit.fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
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
        /* Prevent text and elements from cutting across pages */
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
    return <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>;
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={32} />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Unavailable</h2>
          <p className="text-gray-500">{error || "This proposal is not available."}</p>
        </div>
      </div>
    );
  }

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
        .branded-prose h1 {
          font-size: 2.25rem;
        }
        .branded-prose h2 {
          font-size: 1.875rem;
        }
        .branded-prose h3 {
          font-size: 1.5rem;
        }
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
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm whitespace-nowrap"
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
                    className="text-sm hover:opacity-70 font-medium transition-opacity"
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
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
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
