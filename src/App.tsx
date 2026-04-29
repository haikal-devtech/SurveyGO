import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useNavigate
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole, OperationType, FirestoreErrorInfo } from './types';
import { SURVEY_TYPES } from './constants';
import { Loader2 } from 'lucide-react';
import { cn } from './lib/utils';
import { motion } from 'motion/react';
import { ClientDashboard } from './pages/client/Dashboard';
import { SurveyorDashboard } from './pages/surveyor/Dashboard';
import { AdminDashboard } from './pages/admin/Dashboard';

// --- Error Handler ---
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      alert("Gagal login: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Mock Components for now ---
const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50 flex items-center justify-between px-6 md:px-12">
        <div className="text-2xl font-black text-blue-600 tracking-tighter">SURVEYGO</div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="text-sm font-semibold hover:text-blue-600 transition">Log In</button>
          <button onClick={() => navigate('/login')} className="px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition">Join Now</button>
        </div>
      </nav>

      {/* Hero */}
      <main className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              On-Demand Survey Service
            </div>
            <h1 className="text-6xl md:text-7xl font-black leading-[0.9] tracking-tighter">
              Get Your Land <br />
              <span className="text-blue-600">Surveyed Properly.</span>
            </h1>
            <p className="text-xl text-slate-500 max-w-lg leading-relaxed">
              Connect with verified professional surveyors for land mapping, building inspection, and more. Transparent pricing, real-time tracking.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button 
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-xl shadow-blue-200"
              >
                Hire a Surveyor
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-bold text-lg hover:border-slate-300 transition-all"
              >
                Join as Surveyor
              </button>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
             <div className="aspect-square rounded-[3rem] bg-slate-100 overflow-hidden relative shadow-2xl border-8 border-white">
               <img 
                src="/images/hero-surveyor.png" 
                className="w-full h-full object-cover" 
                alt="Professional Field Surveyor working with Total Station" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
            </div>
            {/* Floating stats card */}
            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 hidden md:block">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold">500+</p>
                  <p className="text-xs text-slate-500 font-medium">Verified Professionals</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Tech Section - Topographic Hologram */}
      <section className="py-24 px-6 md:px-12 bg-slate-900 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
           <img 
            src="/images/topo-hologram.png" 
            className="w-full h-full object-cover" 
            alt="Futuristic holographic topographic map" 
          />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter leading-tight italic">
                Precision Meets <br /> <span className="text-blue-500">Digital Intelligence.</span>
              </h2>
              <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                We transform traditional surveying data into intelligent holographic insights. Real-time 3D terrain mapping, coordinate precision, and cloud-synced reports.
              </p>
              <div className="space-y-4">
                 <div className="flex items-center gap-4 text-white font-bold">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs">01</div>
                    <span>3D Topographic Visualization</span>
                 </div>
                 <div className="flex items-center gap-4 text-white font-bold">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs">02</div>
                    <span>Global Coordinate Precision</span>
                 </div>
                 <div className="flex items-center gap-4 text-white font-bold">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs">03</div>
                    <span>Instant Digital Certificate</span>
                 </div>
              </div>
            </div>
            <div className="rounded-[2.5rem] bg-blue-600/10 p-4 border border-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.2)]">
                <div className="aspect-[4/3] rounded-[2rem] overflow-hidden bg-slate-800">
                    <img 
                      src="/images/tech-tablet.png" 
                      className="w-full h-full object-cover opacity-80" 
                      alt="3D Terrain Map on Tablet" 
                    />
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* AR Construction Section */}
      <section className="py-24 px-6 md:px-12 bg-white">
        <div className="max-w-7xl mx-auto">
           <div className="grid lg:grid-cols-2 gap-16 items-center flex-row-reverse">
              <div className="order-2 lg:order-1 relative">
                  <div className="aspect-square rounded-[3rem] bg-slate-100 overflow-hidden shadow-2xl relative">
                     <img 
                      src="/images/construction-ar.png" 
                      className="w-full h-full object-cover" 
                      alt="Surveyor using AR Tablet on Construction Site" 
                    />
                  </div>
                  <div className="absolute top-1/2 -right-8 -translate-y-1/2 bg-blue-600 p-8 rounded-full shadow-2xl text-white hidden xl:block">
                     <span className="text-xs font-black uppercase tracking-widest vertical-rl">Augmented Reality</span>
                  </div>
              </div>
              <div className="order-1 lg:order-2">
                 <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tighter italic">Smart Construction <br /> Alignment</h2>
                 <p className="text-slate-500 text-lg mb-8 leading-relaxed">
                    Our platform supports AR overlays, allowing you to see building wireframes aligned with the real world. Verify structural integrity and site progress with a single tablet swipe.
                 </p>
                 <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition">Explore Construction Services</button>
              </div>
           </div>
        </div>
      </section>

      {/* Drone Section */}
      <section className="py-24 px-6 md:px-12 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                Next-Gen Data Collection
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tighter italic">Aerial Precision with AI Drone Fleet</h2>
              <p className="text-slate-500 text-lg mb-8 leading-relaxed">
                Cover hundreds of acres in minutes. Our surveyors utilize professional-grade LiDAR and photogrammetry drones to generate high-resolution 3D models and precise digital terrain data.
              </p>
              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <p className="text-3xl font-black text-purple-600 mb-1">99.9%</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Accuracy Rate</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <p className="text-3xl font-black text-purple-600 mb-1">5x</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Faster Delivery</p>
                 </div>
              </div>
            </div>
            <div className="relative">
               <div className="aspect-video rounded-[3rem] overflow-hidden shadow-2xl relative bg-slate-200">
                  <img 
                    src="/images/drone-survey.png" 
                    className="w-full h-full object-cover" 
                    alt="Professional Surveying Drone Operation" 
                  />
                  <div className="absolute inset-0 bg-blue-600/10 mix-blend-overlay" />
               </div>
               <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500 rounded-full blur-[100px] opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-slate-50 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Professional Services</h2>
            <p className="text-slate-500">Choosing the right survey for your project needs.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SURVEY_TYPES.map((type) => (
              <ServiceCard 
                key={type.id}
                title={type.name} 
                icon={<type.icon />} 
                color={type.id === 'topo' ? 'blue' : type.id === 'insp' ? 'green' : type.id === 'geo' ? 'orange' : 'purple'} 
                description={type.description}
                imageUrl={type.imageUrl}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const ServiceCard = ({ title, icon, color, description, imageUrl }: any) => {
  const colors: any = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    orange: "bg-orange-600",
    purple: "bg-purple-600",
  };
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all group overflow-hidden flex flex-col">
      <div className="h-40 relative overflow-hidden">
        <img 
          src={imageUrl} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          alt={title}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
        <div className={cn("absolute bottom-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg", colors[color])}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
      </div>
      <div className="p-6 flex-1">
        <h3 className="text-lg font-black mb-2 tracking-tighter italic">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">{description}</p>
      </div>
    </div>
  );
};

const Plane = (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const Database = (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
const ShieldCheck = (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const CheckCircle = (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const MapPin = (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const LoginPage = () => {
  const { login, profile, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'client') navigate('/client');
      else if (profile.role === 'surveyor') navigate('/surveyor');
      else if (profile.role === 'admin') navigate('/admin');
    } else if (user && !profile) {
      navigate('/onboarding');
    }
  }, [user, profile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-6">Welcome to SurveyGo</h2>
         <button 
          onClick={login}
          className="w-full flex items-center justify-center gap-3 px-4 py-2 border rounded-lg hover:bg-slate-50 transition"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            className="w-5 h-5" 
            alt="Google" 
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
};

const OnboardingPage = () => {
  const { user, profile, setProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = React.useState<'role' | 'interest' | 'surveyor_details'>('role');
  const [selectedRole, setSelectedRole] = React.useState<UserRole | null>(null);
  const [surveyorDetails, setSurveyorDetails] = React.useState({ license: '', certUrl: '' });

  const handleOnboardingComplete = async (role: UserRole, extraData: any = {}) => {
    if (!user) return;
    const newProfile = {
      uid: user.uid,
      email: user.email!,
      displayName: user.displayName || 'User',
      role: role,
      createdAt: serverTimestamp(),
      status: 'active',
      isOnline: false,
      onboardingCompleted: true,
      ...extraData
    };

    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      
      if (role === 'surveyor') {
        await setDoc(doc(db, 'surveyorProfiles', user.uid), {
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName || 'User',
          licenseNumber: surveyorDetails.license,
          certificationUrl: surveyorDetails.certUrl,
          isVerified: false,
          createdAt: serverTimestamp()
        });
      }

      setProfile(newProfile as any);
      navigate(`/${role}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  // Check if onboarding is already completed
  React.useEffect(() => {
    if (profile?.onboardingCompleted) {
      navigate(`/${profile.role}`);
    }
  }, [profile, navigate]);

  if (step === 'surveyor_details' && selectedRole === 'surveyor') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter italic">Professional Credentials</h2>
          <p className="text-slate-500 font-medium tracking-tight">We need these to verify your professional status.</p>
        </motion.div>
        <div className="w-full max-w-md bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
           <div className="space-y-6">
              <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">License Number</label>
                 <input 
                    type="text" 
                    value={surveyorDetails.license}
                    onChange={(e) => setSurveyorDetails({...surveyorDetails, license: e.target.value})}
                    placeholder="e.g. LIC-12345678"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                 />
              </div>
              <div>
                 <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Certification Link (PDF/Drive)</label>
                 <input 
                    type="text" 
                    value={surveyorDetails.certUrl}
                    onChange={(e) => setSurveyorDetails({...surveyorDetails, certUrl: e.target.value})}
                    placeholder="Paste link to your credentials"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                 />
              </div>
              <button 
                disabled={!surveyorDetails.license || !surveyorDetails.certUrl}
                onClick={() => handleOnboardingComplete('surveyor')}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-xl shadow-blue-100"
              >
                Submit Application
              </button>
           </div>
        </div>
      </div>
    );
  }

  if (step === 'interest' && selectedRole === 'client') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter italic">One last thing...</h2>
          <p className="text-slate-500 font-medium tracking-tight">What are you planning to survey?</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
          {['Housing & Real Estate', 'Land Measurement', 'Topography Study', 'Building Inspection', 'Infrastructure', 'Other'].map(interest => (
            <button
              key={interest}
              onClick={() => handleOnboardingComplete('client', { surveyInterest: interest })}
              className="p-8 bg-white border-2 border-slate-200 rounded-[2rem] hover:border-blue-600 hover:bg-blue-50/30 transition-all text-center group"
            >
              <h3 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-blue-700">{interest}</h3>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-12">
        <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter italic">What brings you to SurveyGo?</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Choose your path to get started</p>
      </motion.div>
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileActive={{ scale: 0.98 }}
          onClick={() => {
            setSelectedRole('client');
            setStep('interest');
          }}
          className="p-8 bg-white border-2 border-slate-200 rounded-[2.5rem] hover:border-blue-600 transition-all text-left shadow-xl shadow-slate-200/50 group"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-3xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:rotate-6">
            <UserIcon className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black mb-2 text-slate-900 tracking-tighter italic">I need a survey</h3>
          <p className="text-slate-500 font-medium leading-relaxed">I want to hire professional surveyors to map, inspect or measure my land and property.</p>
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileActive={{ scale: 0.98 }}
          onClick={() => {
            setSelectedRole('surveyor');
            setStep('surveyor_details');
          }}
          className="p-8 bg-white border-2 border-slate-200 rounded-[2.5rem] hover:border-green-600 transition-all text-left shadow-xl shadow-slate-200/50 group"
        >
          <div className="w-16 h-16 bg-green-100 rounded-3xl flex items-center justify-center mb-6 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all transform group-hover:-rotate-6">
            <BriefcaseIcon className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black mb-2 text-slate-900 tracking-tighter italic">I am a surveyor</h3>
          <p className="text-slate-500 font-medium leading-relaxed">I want to provide professional survey services, earn money and grow my client base.</p>
        </motion.button>
      </div>

      {user?.email === 'haikalpasha207@gmail.com' && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => handleOnboardingComplete('admin')}
          className="mt-12 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-blue-600 transition"
        >
          [ Dev Only ] Access Admin Panel
        </motion.button>
      )}
    </div>
  );
};

// --- Dashboard Icons (Temporary place) ---
const UserIcon = ({ className }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const BriefcaseIcon = ({ className }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;

import { ThemeProvider } from './lib/ThemeContext';

// ... App component setup ...
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* Main Dashboards with Guards */}
            <Route path="/client/*" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
            <Route path="/surveyor/*" element={<ProtectedRoute role="surveyor"><SurveyorDashboard /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: UserRole }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
  
  if (!user) return <Navigate to="/" />;
  if (profile?.role !== role) return <Navigate to="/" />;
  
  return <>{children}</>;
};
