import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Save, Loader2, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';

export interface BrandProfile {
  id: string;
  name: string;
  logo: string;
  brandKit: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    fontFamily: string;
  };
}

const DEFAULT_BRAND_KIT = {
  primary: '#0A271C',
  secondary: '#62FFB2',
  accent: '#1A6349',
  background: '#EAF3EB',
  text: '#1A6349',
  fontFamily: 'Questrial'
};

export default function Settings() {
  const { user } = useAuth();
  
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const docRef = doc(db, 'settings', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.brandProfiles && data.brandProfiles.length > 0) {
            setBrandProfiles(data.brandProfiles);
            setActiveProfileId(data.brandProfiles[0].id);
          } else if (data.companyName || data.logo || data.brandKit) {
            // Migrate old data
            const migratedProfile: BrandProfile = {
              id: 'default',
              name: data.companyName || 'Default Brand',
              logo: data.logo || '',
              brandKit: data.brandKit || DEFAULT_BRAND_KIT
            };
            setBrandProfiles([migratedProfile]);
            setActiveProfileId(migratedProfile.id);
          } else {
            // No data at all
            const newProfile: BrandProfile = { id: 'default', name: 'My Brand', logo: '', brandKit: DEFAULT_BRAND_KIT };
            setBrandProfiles([newProfile]);
            setActiveProfileId(newProfile.id);
          }
        } else {
          // No doc exists
          const newProfile: BrandProfile = { id: 'default', name: 'My Brand', logo: '', brandKit: DEFAULT_BRAND_KIT };
          setBrandProfiles([newProfile]);
          setActiveProfileId(newProfile.id);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  const activeProfile = brandProfiles.find(p => p.id === activeProfileId) || brandProfiles[0];

  const handleUpdateActiveProfile = (updates: Partial<BrandProfile>) => {
    setBrandProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, ...updates } : p));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleUpdateActiveProfile({ logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleBrandChange = (key: keyof typeof DEFAULT_BRAND_KIT, value: string) => {
    if (!activeProfile) return;
    handleUpdateActiveProfile({
      brandKit: { ...activeProfile.brandKit, [key]: value }
    });
  };

  const handleAddProfile = () => {
    const newId = Date.now().toString();
    const newProfile: BrandProfile = {
      id: newId,
      name: 'New Brand Profile',
      logo: '',
      brandKit: DEFAULT_BRAND_KIT
    };
    setBrandProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newId);
  };

  const handleDeleteProfile = (id: string) => {
    if (brandProfiles.length <= 1) {
      alert("You must have at least one brand profile.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to delete this brand profile?");
    if (!confirmDelete) return;
    
    const newProfiles = brandProfiles.filter(p => p.id !== id);
    setBrandProfiles(newProfiles);
    if (activeProfileId === id) {
      setActiveProfileId(newProfiles[0].id);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        brandProfiles,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-900" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Brand Settings</h1>
          <p className="text-gray-500 text-sm">Configure multiple brand profiles for your proposals.</p>
        </div>
        <button 
          onClick={handleAddProfile}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Profile
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Profile to Edit</label>
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm bg-white"
            >
              {brandProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {brandProfiles.length > 1 && (
            <button 
              onClick={() => handleDeleteProfile(activeProfileId)}
              className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Profile"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {activeProfile && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand / Company Name</label>
              <input 
                type="text" 
                value={activeProfile.name}
                onChange={(e) => handleUpdateActiveProfile({ name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
                placeholder="e.g. Growth Agency"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </label>
                </div>
                {activeProfile.logo && (
                  <div className="w-32 h-32 border border-gray-200 rounded-xl p-2 flex items-center justify-center bg-white relative group">
                    <img src={activeProfile.logo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                    <button 
                      onClick={() => handleUpdateActiveProfile({ logo: '' })}
                      className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Design System</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Primary Color', key: 'primary' },
                  { label: 'Secondary Color', key: 'secondary' },
                  { label: 'Accent Color', key: 'accent' },
                  { label: 'Background Color', key: 'background' },
                  { label: 'Text Color', key: 'text' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={activeProfile.brandKit[key as keyof typeof DEFAULT_BRAND_KIT]}
                        onChange={(e) => handleBrandChange(key as keyof typeof DEFAULT_BRAND_KIT, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                      />
                      <input 
                        type="text" 
                        value={activeProfile.brandKit[key as keyof typeof DEFAULT_BRAND_KIT]}
                        onChange={(e) => handleBrandChange(key as keyof typeof DEFAULT_BRAND_KIT, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm uppercase"
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                  <input 
                    type="text" 
                    value={activeProfile.brandKit.fontFamily}
                    onChange={(e) => handleBrandChange('fontFamily', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
                    placeholder="e.g. Questrial"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-green-600 font-medium">{successMsg}</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-gray-500">
        Developed by <a href="https://www.linkedin.com/in/aliamin2001/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 underline">Ali Amin</a>
      </div>
    </div>
  );
}
