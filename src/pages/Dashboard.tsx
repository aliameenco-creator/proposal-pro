import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { FileText, Plus, Trash2, ExternalLink, CheckCircle2, Clock, Edit } from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  clientName: string;
  status: 'draft' | 'sent' | 'approved';
  updatedAt: any;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'proposals'),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Proposal[];
      setProposals(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching proposals:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this proposal?')) {
      try {
        await deleteDoc(doc(db, 'proposals', id));
      } catch (error) {
        console.error("Error deleting proposal:", error);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-900 text-white"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case 'sent':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-800"><ExternalLink className="w-3 h-3" /> Sent</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600"><Clock className="w-3 h-3" /> Draft</span>;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Your Proposals</h1>
        <Link
          to="/editor/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors font-medium shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Create Proposal
        </Link>
      </div>

      {proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No proposals yet</h3>
          <p className="text-gray-500 mb-6 text-sm">Create your first AI-powered proposal to get started.</p>
          <Link
            to="/editor/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Proposal
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Link
              key={proposal.id}
              to={`/editor/${proposal.id}`}
              className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all hover:border-gray-300 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                {getStatusBadge(proposal.status)}
                <button
                  onClick={(e) => handleDelete(proposal.id, e)}
                  className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">{proposal.title || 'Untitled Proposal'}</h3>
              <p className="text-gray-500 text-sm mb-4 flex-1">Client: {proposal.clientName || 'Unspecified'}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-100 mt-auto">
                <span>Updated {proposal.updatedAt?.toDate ? format(proposal.updatedAt.toDate(), 'MMM d, yyyy') : 'Just now'}</span>
                <span className="flex items-center gap-1 text-gray-900 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit className="w-3 h-3" /> Edit
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
