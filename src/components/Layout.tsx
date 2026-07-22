import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, LogOut, LayoutDashboard, PlusCircle, Mail, Lock, Settings as SettingsIcon, Bell } from 'lucide-react';

export default function Layout() {
  const { user, logout, signInWithPassword } = useAuth();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('ownerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    try {
      await signInWithPassword(password);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#e38c35]" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="12" r="3.5" fill="currentColor" />
                <path d="M 15 7 A 6 6 0 0 1 15 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Welcome to Proposal Pro</h1>
            <p className="text-sm text-gray-500">Sign in to create and manage your proposals.</p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {authError}
            </div>
          )}

          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-colors disabled:opacity-70"
            >
              {isLoading ? 'Please wait...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-gray-900 font-semibold text-xl">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#e38c35]" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="12" r="3.5" fill="currentColor" />
                <path d="M 15 7 A 6 6 0 0 1 15 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span>Proposal Pro</span>
            </Link>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-medium text-sm">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link to="/editor/new" className="text-gray-900 hover:text-black flex items-center gap-2 font-medium text-sm">
              <PlusCircle className="w-4 h-4" />
              New Proposal
            </Link>
            <div className="h-6 w-px bg-gray-200"></div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative text-gray-500 hover:text-gray-900 transition-colors p-1"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                  <div className="p-3 border-b border-gray-100 font-semibold text-sm text-gray-900">
                    Notifications
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 border-b border-gray-50 text-sm ${n.read ? 'bg-white' : 'bg-blue-50/50'}`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <p className="text-gray-800">{n.message}</p>
                          <span className="text-xs text-gray-400 mt-1 block">
                            {n.createdAt?.toDate ? new Date(n.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/settings" className="text-gray-500 hover:text-gray-900 transition-colors p-1">
              <SettingsIcon className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-3 ml-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-medium text-sm">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
              )}
              <button onClick={handleLogout} className="text-gray-500 hover:text-gray-900 transition-colors p-1">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
