import React from 'react';
import { useAuth, handleFirestoreError } from '../../App';
import { useTheme } from '../../lib/ThemeContext';
import { 
  LayoutDashboard, 
  MapPin, 
  History, 
  LogOut, 
  Plus, 
  Map as MapIcon,
  Bell,
  Star,
  CheckCircle2,
  X,
  Calendar,
  DollarSign,
  User,
  ClipboardList,
  Settings,
  ChevronRight,
  Sun,
  Moon,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { NewSurveyModal } from '../../components/NewSurveyModal';
import { Chat } from '../../components/Chat';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, limit, serverTimestamp } from 'firebase/firestore';
import { Order, OperationType, UserProfile, Notification } from '../../types';
import { SURVEY_TYPES } from '../../constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const ClientDashboard = () => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'surveys' | 'history' | 'map' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [surveyors, setSurveyors] = React.useState<UserProfile[]>([]);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [ratingOrder, setRatingOrder] = React.useState<Order | null>(null);

  React.useEffect(() => {
    if (!profile) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      where('clientId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const surveyorQuery = query(
      collection(db, 'users'),
      where('role', '==', 'surveyor')
    );

    const notifQuery = query(
      collection(db, 'users', profile.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubSurveyors = onSnapshot(surveyorQuery, (snapshot) => {
      setSurveyors(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${profile.uid}/notifications`);
    });

    return () => {
      unsubOrders();
      unsubSurveyors();
      unsubNotifs();
    };
  }, [profile]);

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this survey request?')) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

  const handleRateOrder = async (orderId: string, rating: number, review: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        rating,
        review,
        updatedAt: serverTimestamp()
      });
      setRatingOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

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

  const [unreadCount, setUnreadCount] = React.useState(0);
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

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden transition-colors duration-300">
      <NewSurveyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <AnimatePresence>
        {ratingOrder && (
          <RatingModal 
            order={ratingOrder} 
            onClose={() => setRatingOrder(null)} 
            onSubmit={handleRateOrder} 
            theme={theme}
          />
        )}
      </AnimatePresence>

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
                otherPartyName="Assigned Surveyor"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MapPin className="text-white" size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white italic lowercase">surveyGo</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<MapPin size={20} />} label="Active Surveys" active={activeTab === 'surveys'} onClick={() => setActiveTab('surveys')} />
          <SidebarLink icon={<History size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarLink icon={<MapIcon size={20} />} label="Survey Map" active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
          <SidebarLink icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-white rounded-xl font-bold transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 transition-colors">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white capitalize tracking-tight">{activeTab}</h2>
          
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
                <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="dashboard">
                <DashboardHome orders={orders} onNewOrder={() => setIsModalOpen(true)} onCancel={handleCancelOrder} onRate={setRatingOrder} onChat={openChat} notifications={notifications} />
              </motion.div>
            )}
            {activeTab === 'surveys' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="surveys">
                <SurveyList 
                  title="Active Survey Orders" 
                  orders={orders.filter(o => !['completed', 'cancelled'].includes(o.status))} 
                  onCancel={handleCancelOrder} 
                  onChat={openChat}
                  notifications={notifications}
                />
              </motion.div>
            )}
            {activeTab === 'history' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="history">
                <SurveyList 
                  title="Order History" 
                  orders={orders.filter(o => ['completed', 'cancelled'].includes(o.status))} 
                  onRate={setRatingOrder}
                  onChat={openChat}
                  notifications={notifications}
                />
              </motion.div>
            )}
            {activeTab === 'map' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="map">
                <MapView orders={orders} surveyors={surveyors} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="settings">
                <SettingsTab profile={profile} />
              </motion.div>
            )}
          </AnimatePresence>
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
      active ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
    )}
  >
    {icon}
    {label}
  </button>
);

const DashboardHome = ({ orders, onNewOrder, onCancel, onRate, onChat, notifications }: { orders: Order[], onNewOrder: () => void, onCancel: (id: string) => void, onRate: (o: Order) => void, onChat: (o: Order) => void, notifications: Notification[] }) => {
  const { theme } = useTheme();
  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed');

  // Process data for the chart
  const chartData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data: { name: string, value: number }[] = [];
    
    // Last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = months[d.getMonth()];
      const monthValue = orders
        .filter(o => {
          const od = new Date(o.createdAt);
          return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
        })
        .reduce((sum, o) => sum + o.price, 0);
      
      data.push({ name: monthName, value: monthValue });
    }
    return data;
  }, [orders]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic">Welcome back!</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-1">Manage your active surveys and explore new land services.</p>
        </div>
        <button 
          onClick={onNewOrder}
          className="bg-blue-600 text-white px-8 py-5 rounded-[2rem] font-black flex items-center gap-2 hover:bg-blue-700 hover:scale-105 transition active:scale-95 shadow-2xl shadow-blue-200 dark:shadow-blue-900/20 w-fit"
        >
          <Plus size={24} />
          New Survey Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-[2.5rem] shadow-xl shadow-blue-200 dark:shadow-blue-900/10 text-white flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
              <MapPin size={24} />
            </div>
            <p className="text-blue-100 font-black uppercase tracking-widest text-[10px]">Current Tracking</p>
            <h3 className="text-3xl font-black tracking-tighter mt-1">{activeOrders.length} Active Proyek</h3>
          </div>
          <button 
            onClick={() => {}} 
            className="w-fit px-6 py-2.5 bg-white text-blue-600 rounded-full font-black text-xs hover:bg-blue-50 transition"
          >
            Track in Real-time
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
           <div>
              <div className="w-12 h-12 bg-green-50 dark:bg-green-600/10 rounded-2xl flex items-center justify-center mb-4 text-green-600">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Archived</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mt-1">{completedOrders.length}</h3>
           </div>
           <p className="text-xs text-slate-500 font-medium">Successfully completed surveys.</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
           <div>
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-600/10 rounded-2xl flex items-center justify-center mb-4 text-orange-600">
                <DollarSign size={24} />
              </div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Investment</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter mt-1 truncate">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(orders.reduce((sum, o) => sum + o.price, 0))}
              </h3>
           </div>
           <p className="text-xs text-slate-500 font-medium">Total services requested.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">Investment Trends</h3>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Last 6 Monthly Spending (IDR)</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-blue-600">
              <BarChart3 size={24} />
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(val) => `Rp${val / 1000000}M`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '16px'
                  }} 
                  itemStyle={{ color: '#2563eb', fontWeight: 900, fontSize: '14px' }}
                  labelStyle={{ color: theme === 'dark' ? '#64748b' : '#94a3b8', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#2563eb" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute inset-0 opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity">
             <img 
               src="https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&q=80&w=1000" 
               className="w-full h-full object-cover" 
               alt="Digital Grid Overlay" 
               referrerPolicy="no-referrer"
             />
          </div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-600 rounded-full blur-[80px] opacity-40" />
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-purple-600 rounded-full blur-[60px] opacity-20" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
               <span className="px-2 py-1 bg-blue-600 rounded text-[10px] font-black uppercase tracking-widest">New</span>
               <span className="text-xs font-bold text-blue-400">Digital Topography</span>
            </div>
            <h3 className="text-3xl font-black italic tracking-tighter leading-none">Unlock Precise <br /> 3D Analysis</h3>
            <p className="text-slate-400 font-medium mt-4 leading-relaxed">Experience high-resolution drone mapping and topographic heatmaps for your next project.</p>
          </div>

          <div className="mt-12 relative z-10 pt-10 border-t border-slate-800">
            <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black hover:bg-slate-100 transition active:scale-95 shadow-xl shadow-white/5">
              Explore Tech Services
            </button>
          </div>
        </div>
      </div>

      <SurveyList title="Recent Activity" orders={activeOrders.slice(0, 5)} onCancel={onCancel} onRate={onRate} onChat={onChat} notifications={notifications} />
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
    <div className="flex items-center justify-between mb-4 relative z-10">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition">{icon}</div>
    </div>
    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter relative z-10">{value}</p>
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full opacity-0 group-hover:opacity-100 transition duration-500" />
  </div>
);

const SurveyList = ({ title, orders, onCancel, onRate, onChat, notifications }: { title: string, orders: Order[], onCancel?: (id: string) => void, onRate?: (o: Order) => void, onChat?: (o: Order) => void, notifications: Notification[] }) => (
  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
       <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">{title}</h3>
       <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border dark:border-slate-700 px-3 py-1 rounded-full uppercase tracking-wider">{orders.length} items</span>
    </div>

    {orders.length === 0 ? (
      <div className="p-20 text-center">
        <ClipboardList size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Nothing to show</p>
      </div>
    ) : (
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {orders.map(order => {
          const surveyType = SURVEY_TYPES.find(t => t.id === order.surveyTypeId);
          const Icon = surveyType?.icon || MapPin;
          return (
            <div key={order.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 group-hover:rotate-3 transition-transform">
                  <img src={surveyType?.imageUrl} alt={surveyType?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{surveyType?.name}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mt-1">
                    <MapPin size={14} className="shrink-0" />
                    <p className="text-xs font-medium truncate max-w-md">{order.location.address}</p>
                  </div>
                  <div className="flex gap-4 mt-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1 text-slate-900 dark:text-slate-300"><DollarSign size={10}/>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(order.price)}</span>
                    <span className="flex items-center gap-1"><Calendar size={10}/>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  {order.notes && (
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Project Brief</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">"{order.notes}"</p>
                      {order.referenceImages && order.referenceImages.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {order.referenceImages.map((img, idx) => (
                            <img key={idx} src={img} alt="Ref" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                {['assigned', 'on_site'].includes(order.status) && onChat && (
                  <button 
                    onClick={() => onChat(order)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-blue-100 hover:scale-105 transition active:scale-95 relative"
                  >
                    Chat
                    {notifications.some(n => !n.read && n.type === 'chat' && n.orderId === order.id) && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                    )}
                  </button>
                )}
                {order.status === 'completed' && order.reportUrl && (
                  <a 
                    href={order.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-emerald-100 hover:scale-105 transition active:scale-95"
                  >
                    View Report
                  </a>
                )}
                {order.status === 'completed' && !order.rating && onRate && (
                  <button 
                    onClick={() => onRate(order)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-orange-100 hover:scale-105 transition active:scale-95"
                  >
                    <Star size={12} fill="currentColor" />
                    Rate Order
                  </button>
                )}
                {order.rating && (
                  <div className="flex items-center gap-1 text-orange-400 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} fill={i < (order.rating || 0) ? "currentColor" : "none"} strokeWidth={3} />
                    ))}
                  </div>
                )}
                {(order.status === 'pending' || order.status === 'assigned') && onCancel && (
                  <button 
                    onClick={() => onCancel(order.id!)}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 px-4 py-2 rounded-xl transition hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
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
      className="relative w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col"
    >
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-black text-2xl tracking-tighter flex items-center gap-3 dark:text-white">
          <Bell size={28} className="text-blue-600" />
          Inbox
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {notifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Bell size={40} className="text-slate-100 dark:text-slate-800 mb-4" />
            <p className="text-slate-400 font-bold text-sm tracking-tight capitalize">Your list is clear</p>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              onClick={() => !n.read && onRead(n.id!)}
              className={cn(
                "p-5 rounded-3xl border transition-all cursor-pointer relative",
                n.read 
                  ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 opacity-60" 
                  : "bg-blue-50/20 dark:bg-blue-600/5 border-blue-100 dark:border-blue-900/30 text-slate-900 dark:text-white shadow-sm"
              )}
            >
              {!n.read && <span className="absolute top-6 left-2 w-1.5 h-1.5 bg-blue-600 rounded-full" />}
              <p className="font-black text-sm mb-1 tracking-tight">{n.title}</p>
              <p className="text-xs font-medium leading-relaxed mb-3 opacity-70">{n.message}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{new Date(n.createdAt).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </div>
    </motion.div>
  </div>
);

const RatingModal = ({ order, onClose, onSubmit, theme }: { order: Order, onClose: () => void, onSubmit: (id: string, r: number, rev: string) => void, theme: string }) => {
  const [rating, setRating] = React.useState(5);
  const [review, setReview] = React.useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" />
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl text-center">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-4 italic">Survey Success!</h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight mb-10 leading-relaxed">Please help us improve by rating the survey quality at<br/><span className="text-slate-900 dark:text-white font-bold">{order.location.address}</span></p>
        
        <div className="flex justify-center gap-3 mb-10">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={() => setRating(star)} className="hover:scale-125 transition-transform duration-200 active:scale-95">
              <Star size={44} fill={star <= rating ? "#F59E0B" : "none"} color={star <= rating ? "#F59E0B" : (theme === 'dark' ? "#334155" : "#E2E8F0")} strokeWidth={2.5} />
            </button>
          ))}
        </div>

        <textarea 
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Optional comments about our mitra (surveyor)..."
          className="w-full p-6 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-3xl h-32 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition text-sm font-medium mb-8"
        />

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 font-black text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition tracking-widest text-[10px] uppercase">Skip</button>
          <button onClick={() => onSubmit(order.id!, rating, review)} className="flex-2 py-5 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 shadow-xl shadow-blue-200 dark:shadow-none transition">Complete</button>
        </div>
      </motion.div>
    </div>
  );
};

const MapView = ({ orders, surveyors }: { orders: Order[], surveyors: UserProfile[] }) => {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [selectedSurveyor, setSelectedSurveyor] = React.useState<UserProfile | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.location.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-black text-2xl tracking-tighter text-slate-900">Coverage Map</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time land survey visualizing</p>
          </div>
          <div className="flex gap-4">
            <LegendItem dot="bg-blue-600" label="Active" />
            <LegendItem dot="bg-green-500" label="Done" />
            <LegendItem dot="bg-purple-500" label="On Site" />
            <LegendItem dot="bg-orange-500" label="Surveyor" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <MapIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by address..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-medium transition"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'assigned', 'on_site', 'completed'].map(s => (
              <button 
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition",
                  statusFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-slate-100 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-30 select-none pointer-events-none">
             <svg width="100%" height="100%" className="text-slate-300">
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />
             </svg>
          </div>

          {filteredOrders.length === 0 && surveyors.length === 0 ? (
            <div className="text-center z-10 px-8">
              <MapIcon size={64} className="mx-auto text-slate-200 mb-6" />
              <p className="text-slate-400 font-black uppercase tracking-tighter text-lg">No locations found</p>
            </div>
          ) : (
            <div className="relative w-full h-full">
              {/* Order Markers */}
              {filteredOrders.map((order) => {
                const x = (order.id?.charCodeAt(0) || 0) % 80 + 10;
                const y = (order.id?.charCodeAt(1) || 0) % 80 + 10;
                return (
                  <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1, zIndex: 100 }}
                    key={order.id} 
                    className="absolute group cursor-pointer" 
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => {
                      setSelectedSurveyor(null);
                      setSelectedOrder(selectedOrder?.id === order.id ? null : order);
                    }}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl border-4 border-white shadow-2xl flex items-center justify-center text-white transition-all transform",
                      selectedOrder?.id === order.id ? "scale-125 ring-4 ring-blue-500/20" : "group-hover:rotate-12",
                      order.status === 'completed' ? "bg-green-500" : 
                      order.status === 'on_site' ? "bg-purple-500" :
                      "bg-blue-600"
                    )}>
                      <MapPin size={22} fill="currentColor" stroke="none" />
                    </div>
                  </motion.div>
                );
              })}

              {/* Surveyor Markers */}
              {surveyors.map((surveyor) => {
                const x = (surveyor.uid?.charCodeAt(0) || 0) % 80 + 10;
                const y = (surveyor.uid?.charCodeAt(1) || 0) % 80 + 10;
                return (
                  <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1, zIndex: 100 }}
                    key={surveyor.uid} 
                    className="absolute group cursor-pointer" 
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => {
                      setSelectedOrder(null);
                      setSelectedSurveyor(selectedSurveyor?.uid === surveyor.uid ? null : surveyor);
                    }}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-4 border-white bg-orange-500 shadow-2xl flex items-center justify-center text-white transition-all transform group-hover:-translate-y-1">
                        <User size={18} />
                      </div>
                      {surveyor.isOnline && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                      )}
                    </div>
                  </motion.div>
                );
              })}

              <AnimatePresence>
                {selectedOrder && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[110]"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <StatusBadge status={selectedOrder.status} />
                        <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-slate-100 rounded-full transition">
                          <X size={14} className="text-slate-400" />
                        </button>
                      </div>
                      <h4 className="font-black text-slate-900 text-lg tracking-tight mb-1">{SURVEY_TYPES.find(t => t.id === selectedOrder.surveyTypeId)?.name}</h4>
                      <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4">{selectedOrder.location.address}</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                           <Calendar size={14} className="text-slate-300" />
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className="font-black text-blue-600 text-lg">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedOrder.price)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {selectedSurveyor && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[110] p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedSurveyor.uid}`} alt="surveyor" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900">{selectedSurveyor.displayName}</h4>
                            <div className="flex items-center gap-1.5">
                               <div className={cn("w-1.5 h-1.5 rounded-full", selectedSurveyor.isOnline ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedSurveyor.isOnline ? "Online" : "Offline"}</p>
                            </div>
                          </div>
                       </div>
                       <button onClick={() => setSelectedSurveyor(null)} className="p-1.5 hover:bg-slate-100 rounded-full transition">
                          <X size={14} className="text-slate-400" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">Certified surveyor available for topography and boundary mapping in this area.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
      </div>
    </div>
  );
};

const SettingsTab = ({ profile }: { profile: UserProfile | null }) => {
  const { setProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [saving, setSaving] = React.useState(false);

  const updateInterest = async (interest: string) => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        surveyInterest: interest
      });
      setProfile({ ...profile, surveyInterest: interest });
    } catch (error) {
      console.error("Update error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-10">
        <div>
          <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic">Settings</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight mt-1">Manage your account and customize your experience.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                <ClipboardList size={20} />
              </div>
              Survey Interest
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed italic">"Personalize your project recommendations and metrics analysis."</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {['Residential', 'Industrial', 'Topography', 'Boundaries'].map(interest => (
              <button
                key={interest}
                disabled={saving}
                onClick={() => updateInterest(interest)}
                className={cn(
                  "px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all",
                  profile?.surveyInterest === interest 
                    ? "bg-blue-600 border-blue-600 text-white" 
                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-300 hover:border-slate-300"
                )}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm">
           <h4 className="font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-600/10 rounded-2xl flex items-center justify-center text-green-600">
                <Bell size={20} />
              </div>
              Notifications
            </h4>
            <div className="space-y-4">
               <PreferenceToggle label="Email Alerts" active={true} />
               <PreferenceToggle label="Project Updates" active={true} />
               <PreferenceToggle label="Marketing" active={false} />
            </div>
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-6 border-2 border-slate-200 dark:border-slate-800">
         <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="avatar" />
            </div>
            <div>
               <h5 className="font-black text-slate-900 dark:text-white text-2xl tracking-tighter leading-none">{profile?.displayName}</h5>
               <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2 bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full w-fit">{profile?.email}</p>
            </div>
         </div>
         {profile?.email === 'haikalpasha207@gmail.com' && (
           <button 
             onClick={async () => {
               if (!profile) return;
               await updateDoc(doc(db, 'users', profile.uid), { role: 'admin' });
               window.location.reload();
             }}
             className="px-8 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black text-xs tracking-widest uppercase hover:scale-105 transition shadow-2xl"
           >
             Go to Admin Controls
           </button>
         )}
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

const LegendItem = ({ dot, label }: { dot: string, label: string }) => (
  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
    <span className={cn("w-2.5 h-2.5 rounded-full", dot)} />
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
  </div>
);

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
      "px-3 py-1 bg-white border rounded-full text-center text-[8px] font-black uppercase tracking-widest",
      styles[status]
    )}>
      {status.replace('_', ' ')}
    </span>
  );
};
