import React from 'react';
import { useAuth, handleFirestoreError } from '../../App';
import { useTheme } from '../../lib/ThemeContext';
import { 
  ClipboardList, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  User, 
  LogOut, 
  TrendingUp,
  Briefcase,
  Power,
  PowerOff,
  Bell,
  CheckCircle,
  ShieldAlert,
  Layers,
  Map as MapIcon,
  X,
  Info,
  Sun,
  Moon,
  LayoutDashboard,
  DollarSign
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp, limit, or } from 'firebase/firestore';
import { Order, OperationType, UserProfile, SurveyorProfile, Notification } from '../../types';
import { SURVEY_TYPES } from '../../constants';
// Removed handleFirestoreError import as it is now at the top
import { Chat } from '../../components/Chat';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const SurveyorDashboard = () => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [surveyorProfile, setSurveyorProfile] = React.useState<SurveyorProfile | null>(null);
  const [activeTab, setActiveTab] = React.useState<'home' | 'jobs' | 'assigned' | 'account'>('home');
  const [isOnline, setIsOnline] = React.useState(profile?.isOnline || false);
  const [activeChatOrder, setActiveChatOrder] = React.useState<Order | null>(null);

  const openChat = (order: Order) => {
    setActiveChatOrder(order);
    // Mark related chat notifications as read
    if (profile) {
      notifications
        .filter(n => !n.read && n.type === 'chat' && n.orderId === order.id)
        .forEach(n => markNotifRead(n.id!));
    }
  };

  const [reportUrl, setReportUrl] = React.useState<string>('');
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    if (!profile) return;
    setIsOnline(profile.isOnline ?? false);

    const q = query(
      collection(db, 'orders'),
      or(
        where('status', '==', 'pending'),
        where('surveyorId', '==', profile.uid)
      ),
      orderBy('createdAt', 'desc')
    );

    // Fetch surveyor profile for verification status
    const profileUnsub = onSnapshot(doc(db, 'surveyorProfiles', profile.uid), (doc) => {
      if (doc.exists()) {
        setSurveyorProfile({ uid: doc.id, ...doc.data() } as SurveyorProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `surveyorProfiles/${profile.uid}`);
    });
    
    // Fetch notifications
    const notifQuery = query(
      collection(db, 'users', profile.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${profile.uid}/notifications`);
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => {
      unsubscribe();
      profileUnsub();
      unsubNotifs();
    };
  }, [profile]);

  React.useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  React.useEffect(() => {
    if (activeChatOrder && profile) {
      notifications
        .filter(n => !n.read && n.type === 'chat' && n.orderId === activeChatOrder.id)
        .forEach(n => markNotifRead(n.id!));
    }
  }, [notifications, activeChatOrder, profile]);

  const markNotifRead = async (id: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid, 'notifications', id), {
        read: true
      });
    } catch (error) {
       console.error("Failed to mark read:", error);
    }
  };

  const toggleOnline = async () => {
    if (!profile) return;
    const newStatus = !isOnline;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: newStatus
      });
      setIsOnline(newStatus);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const createNotification = async (clientId: string, orderId: string, status: string) => {
    const statusMessages: Record<string, { title: string, message: string }> = {
      assigned: { title: 'Surveyor Assigned', message: 'A surveyor has been assigned to your request.' },
      on_site: { title: 'Surveyor On-Site', message: 'The surveyor has arrived at the location.' },
      completed: { title: 'Survey Completed', message: 'Your survey is complete. You can now download the report.' },
      cancelled: { title: 'Order Cancelled', message: 'The survey order has been cancelled.' }
    };

    const content = statusMessages[status];
    if (!content) return;

    try {
      await addDoc(collection(db, 'users', clientId, 'notifications'), {
        ...content,
        type: 'status_change',
        read: false,
        createdAt: serverTimestamp(),
        orderId
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, nextStatus: string, clientId: string, additionalData: any = {}) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updateData: any = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        ...additionalData
      };
      if (nextStatus === 'assigned') {
        updateData.surveyorId = profile?.uid;
      }
      await updateDoc(orderRef, updateData);
      await createNotification(clientId, orderId, nextStatus);
      if (nextStatus === 'completed') setReportUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300">
        <div className="p-6 border-b border-slate-800 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ClipboardList className="text-white" size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white italic">SURVEYGO</h1>
          </div>
          
          {surveyorProfile && (
            <div className={cn(
              "px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest text-center",
              surveyorProfile.isVerified 
                ? "bg-green-600/10 border-green-600/20 text-green-500" 
                : "bg-yellow-600/10 border-yellow-600/20 text-yellow-500"
            )}>
              {surveyorProfile.isVerified ? "Verified Partner" : "Pending Verification"}
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink 
            icon={<LayoutDashboard size={20} />} 
            label="Home" 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')}
          />
          <SidebarLink 
            icon={<ClipboardList size={20} />} 
            label="Available Jobs" 
            active={activeTab === 'jobs'} 
            onClick={() => setActiveTab('jobs')}
          />
          <SidebarLink 
            icon={<Briefcase size={20} />} 
            label="My Assignments" 
            active={activeTab === 'assigned'} 
            onClick={() => setActiveTab('assigned')}
          />
          <SidebarLink 
            icon={<User size={20} />} 
            label="Account" 
            active={activeTab === 'account'} 
            onClick={() => setActiveTab('account')}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={toggleOnline}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition mb-4",
              isOnline ? "bg-green-600/10 text-green-500" : "bg-slate-800 text-slate-500"
            )}
          >
            {isOnline ? <Power size={18} /> : <PowerOff size={18} />}
            {isOnline ? "Status: Online" : "Status: Offline"}
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-white rounded-xl font-bold transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isNotifOpen && (
          <NotificationDrawer 
            notifications={notifications} 
            onClose={() => setIsNotifOpen(false)} 
            onRead={markNotifRead}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeChatOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveChatOrder(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative"
            >
              <Chat 
                orderId={activeChatOrder.id!} 
                currentUserId={profile?.uid!} 
                onClose={() => setActiveChatOrder(null)} 
                otherPartyName="Order Client"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 transition-colors">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white capitalize">{activeTab} Dashboard</h2>
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleTheme}
              className="p-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition"
              title="Toggle Dark Mode"
            >
              {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
            </button>
            <button 
              onClick={() => setIsNotifOpen(true)}
              className="p-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl relative transition"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-4 pl-6 border-l border-slate-100">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{profile?.displayName}</p>
                <p className="text-xs text-slate-400 capitalize">{profile?.role} • {isOnline ? 'Online' : 'Offline'}</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'home' && <SurveyorHome orders={orders} surveyorProfile={surveyorProfile} />}
          {activeTab === 'jobs' && <JobsList orders={orders.filter(o => o.status === 'pending')} onUpdate={updateOrderStatus} surveyorProfile={surveyorProfile} notifications={notifications} />}
          {activeTab === 'assigned' && (
            <JobsList 
              orders={orders.filter(o => o.surveyorId === profile?.uid && o.status !== 'cancelled')} 
              onUpdate={updateOrderStatus} 
              isAssigned 
              onChat={openChat} 
              reportUrl={reportUrl}
              setReportUrl={setReportUrl}
              notifications={notifications}
            />
          )}
          {activeTab === 'account' && <AccountSettings profile={profile} onToggleOnline={toggleOnline} isOnline={isOnline} surveyorProfile={surveyorProfile} />}
        </div>
      </main>
    </div>
  );
};

const SidebarLink = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition",
      active ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-900/50 hover:text-white"
    )}
  >
    {icon}
    {label}
  </button>
);

const NotificationDrawer = ({ notifications, onClose, onRead }: { notifications: Notification[], onClose: () => void, onRead: (id: string) => void }) => (
  <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} 
      className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
    />
    <motion.div 
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col"
    >
      <div className="p-8 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-black text-2xl tracking-tighter flex items-center gap-3">
          <Bell size={28} className="text-blue-600" />
          Inbox
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {notifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Bell size={40} className="text-slate-100 mb-4" />
            <p className="text-slate-400 font-bold text-sm tracking-tight capitalize">Your list is clear</p>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              onClick={() => !n.read && onRead(n.id!)}
              className={cn(
                "p-5 rounded-3xl border transition-all cursor-pointer relative",
                n.read ? "bg-white border-slate-100 text-slate-400 opacity-60" : "bg-blue-50/20 border-blue-100 text-slate-900 shadow-sm"
              )}
            >
              {!n.read && <span className="absolute top-6 left-2 w-1.5 h-1.5 bg-blue-600 rounded-full" />}
              <p className="font-black text-sm mb-1 tracking-tight">{n.title}</p>
              <p className="text-xs font-medium leading-relaxed mb-3 opacity-70">{n.message}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString() : (n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : 'Recently')}
              </p>
            </div>
          ))
        )}
      </div>
    </motion.div>
  </div>
);

const JobsList = ({ 
  orders, 
  onUpdate, 
  isAssigned = false, 
  onChat,
  surveyorProfile,
  reportUrl,
  setReportUrl,
  notifications
}: { 
  orders: Order[], 
  onUpdate: (id: string, st: string, cid: string, data?: any) => void, 
  isAssigned?: boolean, 
  onChat?: (o: Order) => void,
  surveyorProfile?: SurveyorProfile | null,
  reportUrl?: string,
  setReportUrl?: (url: string) => void,
  notifications: Notification[]
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="font-black text-2xl text-slate-900 dark:text-white tracking-tighter italic">{isAssigned ? "My Projects" : "Available Opportunities"}</h3>
      <span className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-800 border dark:border-slate-700 px-3 py-1 rounded-full uppercase tracking-widest">{orders.length} Orders</span>
    </div>

    {!isAssigned && surveyorProfile && !surveyorProfile.isVerified && (
      <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-8 rounded-[2rem] flex items-start gap-6 shadow-xl shadow-yellow-100 dark:shadow-none">
        <div className="w-14 h-14 bg-yellow-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-yellow-200 dark:shadow-none">
          <ShieldAlert size={28} />
        </div>
        <div>
          <h4 className="font-black text-yellow-900 dark:text-yellow-500 text-xl tracking-tighter italic">Verification Pending</h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-600/80 mt-1 font-medium leading-relaxed">Our team is currently reviewing your credentials (License: <span className="font-black underline decoration-yellow-300 underline-offset-4">{surveyorProfile.licenseNumber}</span>). You will be able to accept jobs once verified.</p>
        </div>
      </div>
    )}

    {orders.length === 0 ? (
      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-24 text-center">
        <ClipboardList size={64} className="mx-auto text-slate-200 dark:text-slate-800 mb-6" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Awaiting new opportunities...</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {orders.map(order => {
          const surveyType = SURVEY_TYPES.find(t => t.id === order.surveyTypeId);
          const TypeIcon = surveyType?.icon || MapPin;
          return (
            <motion.div 
              layout
              key={order.id} 
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-800/50 rounded-bl-[4rem] -mr-10 -mt-10 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors" />
              
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 group-hover:rotate-3 transition-transform">
                  <img src={surveyType?.imageUrl} alt={surveyType?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.price)}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Est. Payout</p>
                </div>
              </div>

              <div className="mb-6 relative z-10">
                <h4 className="font-black text-slate-900 dark:text-white text-xl tracking-tight leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{surveyType?.name}</h4>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
                  <MapPin size={16} className="shrink-0 text-slate-300" />
                  <p className="truncate">{order.location.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-black text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-6 mb-8 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <Clock size={16} />
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                {order.area && (
                  <div className="flex items-center gap-1.5">
                    <Layers size={16} />
                    <span>{order.area} m&sup2;</span>
                  </div>
                )}
              </div>

              {order.notes && (
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Project Notes</p>
                  <p className="text-xs text-slate-600 leading-relaxed italic">"{order.notes}"</p>
                  {order.referenceImages && order.referenceImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {order.referenceImages.map((img, idx) => (
                        <div key={idx} className="group/img relative">
                          <img src={img} alt="Ref" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition rounded-xl flex items-center justify-center">
                            <a href={img} target="_blank" rel="noreferrer" className="text-white">
                              <Info size={12} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isAssigned ? (
                <button 
                  disabled={surveyorProfile && !surveyorProfile.isVerified}
                  onClick={() => onUpdate(order.id!, 'assigned', order.clientId)}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
                >
                  Accept Job
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <StatusBadge status={order.status} />
                  {['assigned', 'on_site'].includes(order.status) && onChat && (
                    <button 
                      onClick={() => onChat(order)}
                      className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition relative"
                    >
                      Chat with Client
                      {notifications.some(n => !n.read && n.type === 'chat' && n.orderId === order.id) && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full" />
                      )}
                    </button>
                  )}
                  {order.status === 'assigned' && (
                    <button 
                      onClick={() => onUpdate(order.id!, 'on_site', order.clientId)}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                    >
                      Mark On-Site
                    </button>
                  )}
                  {order.status === 'on_site' && (
                    <div className="space-y-3 mt-2">
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Report URL (PDF/Drive link)"
                          value={reportUrl}
                          onChange={(e) => setReportUrl?.(e.target.value)}
                          className="w-full p-3 text-[10px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                        />
                      </div>
                      <button 
                        disabled={!reportUrl}
                        onClick={() => onUpdate(order.id!, 'completed', order.clientId, { reportUrl })}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100 disabled:opacity-50"
                      >
                        Complete Order
                      </button>
                    </div>
                  )}
                  {order.status === 'completed' && order.reportUrl && (
                    <a 
                      href={order.reportUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition text-center"
                    >
                      View Report
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    )}
  </div>
);

const AccountSettings = ({ profile, onToggleOnline, isOnline, surveyorProfile }: { profile: UserProfile | null, onToggleOnline: () => void, isOnline: boolean, surveyorProfile?: SurveyorProfile | null }) => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-10">
        <div>
          <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic">Settings</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-1">Manage your professional profile and preferences.</p>
        </div>
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
           <button 
             onClick={() => theme === 'dark' && toggleTheme()}
             className={cn("px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition flex items-center gap-2", theme === 'light' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-400")}
           >
             <Sun size={14} /> Light
           </button>
           <button 
             onClick={() => theme === 'light' && toggleTheme()}
             className={cn("px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition flex items-center gap-2", theme === 'dark' ? "bg-blue-600 text-white shadow-xl shadow-blue-800/20" : "text-slate-400")}
           >
             <Moon size={14} /> Dark
           </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 dark:bg-slate-800/30 rounded-bl-[8rem] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
          <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] border-8 border-white dark:border-slate-800 shadow-2xl overflow-hidden ring-1 ring-slate-100 dark:ring-slate-700">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="avatar" />
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
              <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none italic">{profile?.displayName}</h3>
              {surveyorProfile?.isVerified && (
                <div className="bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 p-1.5 rounded-full shadow-sm">
                   <CheckCircle size={14} />
                </div>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">{profile?.email} • Professional Surveyor</p>
            
            <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
              <button 
                onClick={onToggleOnline}
                className={cn(
                  "flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all hover:scale-105 active:scale-95",
                  isOnline 
                  ? "bg-green-600 text-white shadow-xl shadow-green-200 dark:shadow-none" 
                  : "bg-slate-800 dark:bg-slate-700 text-white shadow-xl shadow-slate-200 dark:shadow-none"
                )}
              >
                {isOnline ? <Power size={20} /> : <PowerOff size={20} />}
                {isOnline ? "Working Online" : "Currently Offline"}
              </button>

              {profile?.email === 'haikalpasha207@gmail.com' && (
                <button 
                  onClick={async () => {
                    if (!profile) return;
                    await updateDoc(doc(db, 'users', profile.uid), { role: 'admin' });
                    window.location.reload();
                  }}
                  className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-sm"
                >
                  Admin Access
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8 flex items-center gap-2">
            <ShieldAlert size={16} className="text-blue-600" />
            Verification Credentials
          </h4>
          <div className="space-y-4">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Surveying License ID</p>
               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 font-mono font-bold text-slate-700 dark:text-slate-300">
                  {surveyorProfile?.licenseNumber || 'PRO-99-XX-XXXX'}
               </div>
            </div>
            <div className={cn(
              "p-4 rounded-xl border flex items-center justify-between",
              surveyorProfile?.isVerified 
                ? "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-600" 
                : "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/30 text-yellow-600"
            )}>
              <span className="text-xs font-black uppercase tracking-widest">{surveyorProfile?.isVerified ? "Verified Professional" : "Review in Progress"}</span>
              {surveyorProfile?.isVerified ? <CheckCircle size={18} /> : <Clock size={18} />}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm flex flex-col justify-between">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Business Notifications
          </h4>
          <div className="space-y-4">
               <PreferenceToggle label="Job Alerts" active={true} />
               <PreferenceToggle label="Payment Receipts" active={true} />
               <PreferenceToggle label="Chat Signals" active={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PreferenceToggle = ({ label, active }: { label: string, active: boolean }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm font-bold text-slate-800 dark:text-slate-300">{label}</span>
    <button className={cn(
      "w-12 h-6 rounded-full p-1 transition-colors relative",
      active ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
    )}>
      <div className={cn(
        "w-4 h-4 rounded-full bg-white transition-transform",
        active ? "translate-x-6" : "translate-x-0"
      )} />
    </button>
  </div>
);

const StatCard = ({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">{icon}</div>
    </div>
    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</p>
  </div>
);

const SurveyorHome = ({ orders, surveyorProfile }: { orders: Order[], surveyorProfile: SurveyorProfile | null }) => {
  const { profile } = useAuth();
  
  const myCompletedOrders = orders.filter(o => o.surveyorId === profile?.uid && o.status === 'completed');
  const totalEarnings = myCompletedOrders.reduce((acc, curr) => acc + (curr.price || 0), 0);
  
  // Prepare chart data (Earnings over time)
  const earningsByMonth: Record<string, number> = {};
  myCompletedOrders.forEach(o => {
    const month = new Date(o.createdAt).toLocaleString('default', { month: 'short' });
    earningsByMonth[month] = (earningsByMonth[month] || 0) + (o.price || 0);
  });

  const chartData = Object.entries(earningsByMonth).map(([month, amount]) => ({ month, amount }));

  return (
    <div className="space-y-10">
      <div>
        <h3 className="font-black text-3xl dark:text-white tracking-tighter italic">Welcome back, Partner</h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-1">Here is how your surveying business is performing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-bl-[3rem] transition-all group-hover:scale-110" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Total Earnings</p>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <DollarSign size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalEarnings)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 dark:bg-green-900/10 rounded-bl-[3rem] transition-all group-hover:scale-110" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Completed Jobs</p>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-600/10 rounded-2xl flex items-center justify-center text-green-600">
              <CheckCircle size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{myCompletedOrders.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 dark:bg-purple-900/10 rounded-bl-[3rem] transition-all group-hover:scale-110" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Active Requests</p>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-600">
              <Clock size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {orders.filter(o => o.surveyorId === profile?.uid && ['assigned', 'on_site'].includes(o.status)).length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h4 className="font-black text-slate-900 dark:text-white text-xl tracking-tight">Earnings Analytics</h4>
            <p className="text-sm text-slate-400 font-medium">Monthly revenue progression across projects.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-100 dark:border-slate-700">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Monthly Revenue</span>
          </div>
        </div>
        
        <div className="h-[350px] w-full">
           {chartData.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                 <defs>
                   <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                     <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <XAxis 
                   dataKey="month" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                   dy={10}
                 />
                 <YAxis 
                   hide 
                 />
                 <Tooltip 
                   contentStyle={{ 
                     borderRadius: '16px', 
                     border: 'none', 
                     boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                     backgroundColor: '#1e293b',
                     color: '#fff'
                   }}
                   itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                 />
                 <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorAmount)" />
               </AreaChart>
             </ResponsiveContainer>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
               <TrendingUp size={48} className="mb-4 opacity-20" />
               <p className="font-black uppercase tracking-widest text-xs">Awaiting data completion...</p>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden relative group">
           <img 
            src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1000" 
            className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700" 
            alt="Surveyor professional setup" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent p-10 flex flex-col justify-end">
             <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4">
                <Briefcase size={24} />
             </div>
             <h4 className="text-2xl font-black text-white tracking-tighter italic mb-2">Surveyor Toolbox</h4>
             <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
                Access advanced 3D heatmap visualization and professional reporting tools directly from your tablet.
             </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/10 rounded-2xl flex items-center justify-center text-blue-600">
                 <Layers size={32} />
              </div>
              <div>
                 <h5 className="font-black text-slate-900 dark:text-white tracking-tight">Active Heatmaps</h5>
                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight">3 active projects with topo data</p>
              </div>
           </div>
           
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/10 rounded-2xl flex items-center justify-center text-green-600">
                 <CheckCircle size={32} />
              </div>
              <div>
                 <h5 className="font-black text-slate-900 dark:text-white tracking-tight">Verified Credentials</h5>
                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight">License valid until Dec 2026</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    pending: "bg-yellow-50 text-yellow-600 border-yellow-100",
    assigned: "bg-blue-50 text-blue-600 border-blue-100",
    on_site: "bg-purple-50 text-purple-600 border-purple-100",
    completed: "bg-green-50 text-green-600 border-green-100",
    cancelled: "bg-red-50 text-red-600 border-red-100",
  };
  return (
    <span className={cn(
      "px-3 py-1 bg-white border rounded-full text-center text-[10px] font-bold uppercase tracking-wider",
      styles[status]
    )}>
      {status.replace('_', ' ')}
    </span>
  );
};
