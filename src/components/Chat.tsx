import React from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Message, OperationType } from '../types';
import { handleFirestoreError } from '../App';
import { Send, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ChatProps {
  orderId: string;
  currentUserId: string;
  onClose: () => void;
  otherPartyName?: string;
}

export const Chat = ({ orderId, currentUserId, onClose, otherPartyName }: ChatProps) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [text, setText] = React.useState('');
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastMessageCount = React.useRef(0);

  React.useEffect(() => {
    const q = query(
      collection(db, 'orders', orderId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(docs);
      
      // If a new message arrived from the other party and we aren't at the bottom
      if (docs.length > lastMessageCount.current) {
        const lastMsg = docs[docs.length - 1];
        if (lastMsg.senderId !== currentUserId && !isAtBottom) {
          // Could trigger a toast here if we had one
        }
      }
      lastMessageCount.current = docs.length;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `orders/${orderId}/messages`);
    });

    return unsubscribe;
  }, [orderId, isAtBottom, currentUserId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const messageContent = text.trim();
    setText('');

    try {
      await addDoc(collection(db, 'orders', orderId, 'messages'), {
        senderId: currentUserId,
        text: messageContent,
        createdAt: serverTimestamp()
      });

      // Fetch order to find recipient
      const { doc: firestoreDoc, getDoc } = await import('firebase/firestore');
      const orderSnap = await getDoc(firestoreDoc(db, 'orders', orderId));
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const recipientId = orderData.clientId === currentUserId ? orderData.surveyorId : orderData.clientId;
        
        if (recipientId) {
          await addDoc(collection(db, 'users', recipientId, 'notifications'), {
            title: 'New Message',
            message: messageContent.slice(0, 50) + (messageContent.length > 50 ? '...' : ''),
            type: 'chat',
            read: false,
            createdAt: serverTimestamp(),
            orderId
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}/messages`);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <User size={24} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">{otherPartyName || 'Mitra Surveyor'}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Collaboration</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition text-slate-400 group">
          <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
              <Send size={32} className="text-slate-200 dark:text-slate-700 -rotate-12" />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Start the conversation</p>
            <p className="text-xs text-slate-400 mt-2 font-medium">Messages are encrypted and real-time.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserId;
            const prevMsg = messages[idx - 1];
            const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id} 
                className={cn(
                  "flex flex-col group",
                  isMe ? "items-end" : "items-start"
                )}
              >
                <div className={cn(
                  "flex gap-3 max-w-[85%]",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}>
                  {!isMe && (
                    <div className={cn(
                      "w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0 mt-auto overflow-hidden border-2 border-white dark:border-slate-900 transition-opacity",
                      showAvatar ? "opacity-100" : "opacity-0"
                    )}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`} alt="avatar" />
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <div className={cn(
                      "px-5 py-3.5 rounded-[1.5rem] text-sm font-medium shadow-sm leading-relaxed relative",
                      isMe 
                        ? "bg-blue-600 text-white rounded-br-none shadow-blue-100 dark:shadow-none" 
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700/50 rounded-bl-none"
                    )}>
                      {msg.text}
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-2 mt-1.5 px-1 transition-opacity",
                      isMe ? "flex-row-reverse" : "flex-row"
                    )}>
                      <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </span>
                      {isMe && (
                        <div className="w-1 h-1 bg-blue-400 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        
        {!isAtBottom && messages.length > 0 && (
          <motion.button 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={scrollToBottom}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-full shadow-xl border border-slate-100 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 z-20"
          >
            New Messages
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
          </motion.button>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input 
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 dark:text-white border-none rounded-[1.25rem] text-sm font-medium focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition"
          />
          <button 
            type="submit"
            disabled={!text.trim()}
            className="w-14 h-14 bg-blue-600 text-white rounded-[1.25rem] flex items-center justify-center hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-100 dark:shadow-none disabled:opacity-50 disabled:grayscale disabled:scale-100"
          >
            <Send size={24} className="-rotate-12 group-hover:rotate-0 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
};
