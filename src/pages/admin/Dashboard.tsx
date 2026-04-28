import React from 'react';
import { useAuth, handleFirestoreError } from '../../App';
import { 
  ShieldCheck, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { collection, query, onSnapshot, doc, updateDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SurveyorProfile, OperationType } from '../../types';

export const AdminDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = React.useState('overview');

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-64 bg-slate-800 text-slate-300 flex flex-col shadow-xl">
        <div className="p-8">
          <h1 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white" size={18} />
            </div>
            Admin Hub
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            icon={<AlertCircle size={20} />} 
            label="Verification" 
            active={activeTab === 'verification'} 
            onClick={() => setActiveTab('verification')} 
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Users" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="All Orders" 
            active={activeTab === 'orders'} 
            onClick={() => setActiveTab('orders')} 
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Config" 
            active={activeTab === 'config'} 
            onClick={() => setActiveTab('config')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl w-full transition font-bold text-sm"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-12">
        <header className="mb-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} <span className="text-blue-600">Control</span>
          </h2>
          <p className="text-slate-500 mt-1 font-medium tracking-tight">Manage and oversee the SurveyGo ecosystem.</p>
        </header>

        <div className="max-w-6xl">
          {activeTab === 'verification' && <VerificationTab />}
          {activeTab !== 'verification' && (
            <div className="bg-white rounded-[2rem] p-20 text-center border-2 border-dashed border-slate-200">
              <Settings size={64} className="mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-bold text-slate-400">Section Under Construction</h3>
              <p className="text-slate-400 text-sm mt-1">This module is scheduled for the next deployment phase.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3.5 rounded-xl w-full transition-all group",
      active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-2" : "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
    )}
  >
    <div className={cn(
      "p-1.5 rounded-lg transition-colors",
      active ? "text-white" : "text-slate-500 group-hover:text-slate-300"
    )}>
      {icon}
    </div>
    <span className="font-bold text-sm tracking-tight">{label}</span>
  </button>
);

const VerificationTab = () => {
  const [profiles, setProfiles] = React.useState<SurveyorProfile[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const q = query(collection(db, 'surveyorProfiles'), where('isVerified', '==', false));
    return onSnapshot(q, (snapshot) => {
      setProfiles(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as SurveyorProfile)));
      setLoading(false);
    });
  }, []);

  const handleVerify = async (uid: string, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'surveyorProfiles', uid), {
        isVerified: approve
      });
      
      // Notify surveyor about verification status
      await addDoc(collection(db, 'users', uid, 'notifications'), {
        title: approve ? 'Application Approved' : 'Application Rejected',
        message: approve 
          ? 'Congratulations! Your surveyor application has been approved. You can now start accepting jobs.' 
          : 'Your surveyor application has been rejected. Please review your credentials and try again.',
        type: 'verification',
        read: false,
        createdAt: serverTimestamp(),
        userId: uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'surveyorProfiles');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-100 border-t-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-black text-slate-900 tracking-tight">Pending Verifications</h3>
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
            {profiles.length} items
          </span>
        </div>
        
        {profiles.length === 0 ? (
          <div className="p-20 text-center">
            <UserCheck size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">All clear! No pending applications.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50/30 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Surveyor</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Credentials</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map(profile => (
                <tr key={profile.uid} className="hover:bg-slate-50/30 transition">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-white shadow-sm overflow-hidden shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} alt="avatar" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 tracking-tight">{profile.displayName}</p>
                        <p className="text-xs text-slate-400 font-medium tracking-tight">{profile.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1.5">
                      <p className="text-xs font-black text-slate-600 flex items-center gap-2">
                        <ShieldCheck size={14} className="text-blue-500" />
                        License: {profile.licenseNumber || 'PENDING'}
                      </p>
                      <div className="flex items-center gap-2">
                         {profile.certificationUrl && (
                           <a 
                             href={profile.certificationUrl} 
                             target="_blank" 
                             rel="noreferrer"
                             className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition"
                           >
                             View Certification
                           </a>
                         )}
                         <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded uppercase tracking-widest border border-slate-200">ID_Card.png</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleVerify(profile.uid, false)}
                        className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-black uppercase tracking-widest transition"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleVerify(profile.uid, true)}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 hover:scale-105 transition active:scale-95 flex items-center gap-2"
                      >
                        <UserCheck size={16} />
                        Verify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
