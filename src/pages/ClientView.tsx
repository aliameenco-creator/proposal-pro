import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import SignatureCanvas from 'react-signature-canvas';
import { FileText, CheckCircle2, Loader2, Download } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

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
    
    const opt = {
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
    primary: '#0A271C',
    secondary: '#62FFB2',
    accent: '#1A6349',
    background: '#EAF3EB',
    text: '#1A6349',
    fontFamily: 'Questrial'
  };

  return (
    <div 
      className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" 
      style={{ backgroundColor: brandKit.background, fontFamily: `"${brandKit.fontFamily}", sans-serif` }}
    >
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
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {proposal.logo && (
              <img src={proposal.logo} alt="Company Logo" className="h-12 object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: brandKit.primary }}>{proposal.title || 'Project Proposal'}</h1>
              <p className="text-sm mt-1" style={{ color: brandKit.text }}>Prepared for: <span className="font-medium">{proposal.clientName}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            {proposal.status === 'approved' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700">
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
