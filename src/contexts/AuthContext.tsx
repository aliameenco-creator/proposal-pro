import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signInWithPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuth = localStorage.getItem('proposal_pro_auth');
    if (isAuth === 'true') {
      setUser({ id: 'admin', email: 'admin@proposal.pro' });
    }
    setLoading(false);
  }, []);

  const signInWithPassword = async (password: string) => {
    if (password === 'Ameen@927861') {
      localStorage.setItem('proposal_pro_auth', 'true');
      setUser({ id: 'admin', email: 'admin@proposal.pro' });
    } else {
      throw new Error("Invalid password");
    }
  };

  const logout = async () => {
    localStorage.removeItem('proposal_pro_auth');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithPassword, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
