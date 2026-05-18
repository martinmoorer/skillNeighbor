/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  SkillPost, 
  TradeRequest, 
  UserProfile 
} from './lib/firebase';
import { cn } from './lib/utils';
import { 
  Search, 
  Plus, 
  Handshake, 
  User as UserIcon, 
  ArrowRight, 
  Filter, 
  MapPin, 
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<SkillPost[]>([]);
  const [trades, setTrades] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'trades' | 'profile'>('browse');
  const [filterType, setFilterType] = useState<'all' | 'offer' | 'request'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Auth & Profile Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync profile
        const userRef = doc(db, 'users', u.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || 'Neighbor',
            email: u.email || '',
            photoURL: u.photoURL || '',
            skillsOffered: [],
            skillsWanted: [],
          };
          await setDoc(userRef, { ...newProfile, createdAt: serverTimestamp() });
          setProfile(newProfile);
        } else {
          setProfile(snap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Posts Listener
  useEffect(() => {
    const q = query(collection(db, 'skillPosts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const p: SkillPost[] = [];
      snap.forEach((d) => p.push({ id: d.id, ...d.data() } as SkillPost));
      setPosts(p);
    });
    return unsubscribe;
  }, []);

  // Trades Listener
  useEffect(() => {
    if (!user) {
      setTrades([]);
      return;
    }
    // Listen for trades where user is sender OR receiver
    // Note: Firestore doesn't easily support OR on different fields without complex queries or composite indexes
    // We'll use two listeners or a simplified check if possible
    const qSender = query(collection(db, 'trades'), where('senderId', '==', user.uid));
    const qReceiver = query(collection(db, 'trades'), where('receiverId', '==', user.uid));
    
    const unsubscribeSender = onSnapshot(qSender, (snap) => {
      setTrades(prev => {
        const others = prev.filter(t => t.senderId !== user.uid);
        const mine = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest));
        return [...others, ...mine].sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      });
    });

    const unsubscribeReceiver = onSnapshot(qReceiver, (snap) => {
      setTrades(prev => {
        const others = prev.filter(t => t.receiverId !== user.uid);
        const mine = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest));
        return [...others, ...mine].sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      });
    });

    return () => {
      unsubscribeSender();
      unsubscribeReceiver();
    };
  }, [user]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const matchesFilter = filterType === 'all' || p.type === filterType;
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch && p.active !== false;
    });
  }, [posts, filterType, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-brand-paper">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-10 w-10 border-4 border-brand-olive border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <LandingView onLogin={signInWithGoogle} />;
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Navbar Container */}
      <nav className="sticky top-0 z-40 bg-brand-paper/80 backdrop-blur-md border-b border-brand-ink/5">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-olive rounded-xl flex items-center justify-center text-white">
              <Handshake size={24} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">SkillNeighbor</h1>
          </div>
          
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
              <input 
                type="text" 
                placeholder="Find a skill near you..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-none rounded-2xl py-3 pl-12 pr-4 shadow-sm outline-none focus:ring-2 focus:ring-brand-olive/20 transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-brand-olive text-white px-5 py-2.5 rounded-full font-medium flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap shadow-md"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Post Skill</span>
            </button>
            <button onClick={logout} className="p-2.2 text-brand-ink/50 hover:text-brand-ink transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 mt-8">
        {activeTab === 'browse' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-4xl font-medium italic mb-2">Welcome, {user.displayName?.split(' ')[0]}</h2>
                <p className="text-brand-ink/60 max-w-lg">
                  Neighborly trading is back. Help out with tax seasons, learn a riff on the guitar, or share your secret sourdough starter.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm self-start">
                {(['all', 'offer', 'request'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all",
                      filterType === t 
                        ? "bg-brand-olive text-white shadow-sm" 
                        : "text-brand-ink/40 hover:text-brand-ink/70"
                    )}
                  >
                    {t === 'all' ? 'Everything' : t + 's'}
                  </button>
                ))}
              </div>
            </div>

            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} currentUser={user} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search size={48} className="text-brand-ink/10 mb-4" />
                <h3 className="text-xl font-serif text-brand-ink/40">No skills found Matching your search</h3>
                <button onClick={() => { setSearchQuery(''); setFilterType('all'); }} className="mt-4 text-brand-olive font-medium decoration-brand-olive/30 underline underline-offset-4">Clear all filters</button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'trades' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-4xl font-medium italic mb-4">Community Activity</h2>
            <div className="grid gap-4">
              {trades.length > 0 ? (
                trades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} userId={user.uid} />
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl card-shadow border border-brand-ink/5">
                  <p className="text-brand-ink/40 font-serif italic text-lg">No trades yet. Start a conversation with a neighbor!</p>
                  <button onClick={() => setActiveTab('browse')} className="mt-4 text-brand-olive font-medium">Browse listings</button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
             <ProfileView profile={profile} user={user} userPosts={posts.filter(p => p.authorId === user.uid)} />
          </motion.div>
        )}
      </main>

      {/* Bottom Floating Nav */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-brand-ink text-white/50 px-3 py-3 rounded-full shadow-2xl flex items-center gap-1 backdrop-blur-md">
          <NavBtn icon={<Search size={22} />} active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} label="Browse" />
          <NavBtn icon={<Handshake size={22} />} active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label="Trades" />
          <NavBtn icon={<UserIcon size={22} />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="Profile" />
        </div>
      </div>

      <CreatePostModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} user={user} />
    </div>
  );
}

function NavBtn({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300",
        active ? "bg-white text-brand-ink font-medium shadow-sm" : "hover:text-white"
      )}
    >
      {icon}
      {active && <span className="text-sm font-semibold">{label}</span>}
    </button>
  );
}

function LandingView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-brand-paper flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl relative z-10"
      >
        <div className="w-20 h-20 bg-brand-olive rounded-3xl mx-auto mb-8 flex items-center justify-center text-white shadow-xl shadow-brand-olive/20">
          <Handshake size={48} strokeWidth={1.5} />
        </div>
        <h1 className="text-6xl md:text-8xl font-medium tracking-tight mb-6 italic">Trade skills, <br/>not pennies.</h1>
        <p className="text-xl text-brand-ink/60 mb-10 max-w-lg mx-auto">
          SkillNeighbor connects you with people nearby who want what you know, and know what you need.
        </p>
        <button 
          onClick={onLogin}
          className="bg-brand-ink text-white px-8 py-4 rounded-full text-lg font-medium hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-3 mx-auto"
        >
          Join your Neighborhood <ArrowRight size={20} />
        </button>
      </motion.div>
      
      {/* Ambient background decoration */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-brand-olive/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-brand-olive/3 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
    </div>
  );
}

function PostCard({ post, currentUser }: { post: SkillPost, currentUser: User, key?: string }) {
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const isMine = post.authorId === currentUser.uid;

  return (
    <motion.div 
      layout
      whileHover={{ y: -4 }}
      className="bg-white rounded-3xl p-6 card-shadow border border-brand-ink/5 flex flex-col h-full relative group"
    >
      <div className="flex items-start justify-between mb-4">
        <span className={cn(
          "text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border",
          post.type === 'offer' ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100"
        )}>
          {post.type}ing
        </span>
        <span className="text-xs text-brand-ink/30 italic font-medium">
          {post.category}
        </span>
      </div>

      <h3 className="text-2xl font-medium mb-3 group-hover:text-brand-olive transition-colors leading-tight">
        {post.title}
      </h3>
      <p className="text-brand-ink/60 text-sm mb-6 line-clamp-3 leading-relaxed">
        {post.description}
      </p>

      <div className="mt-auto pt-6 border-t border-brand-ink/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-paper border border-brand-ink/10 flex items-center justify-center text-brand-ink/40 text-[10px] font-bold overflow-hidden">
             {post.authorName.charAt(0)}
          </div>
          <span className="text-xs font-semibold">{post.authorName}</span>
        </div>
        
        {!isMine ? (
          <button 
            onClick={() => setIsTradeModalOpen(true)}
            className="text-brand-olive text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all p-1"
          >
            I'm interested <ArrowRight size={16} />
          </button>
        ) : (
          <span className="text-[10px] text-brand-ink/30 font-bold uppercase tracking-widest italic">My Listing</span>
        )}
      </div>

      <TradeRequestModal 
        isOpen={isTradeModalOpen} 
        onClose={() => setIsTradeModalOpen(false)} 
        post={post} 
        currentUser={currentUser}
      />
    </motion.div>
  );
}

function TradeCard({ trade, userId }: { trade: TradeRequest, userId: string, key?: string }) {
  const isSender = trade.senderId === userId;
  const partnerName = isSender ? 'Receiver' : trade.senderName;
  
  const updateStatus = async (newStatus: string) => {
    try {
      await updateDoc(doc(db, 'trades', trade.id), { status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const statusInfo = {
    pending: { color: 'text-amber-600 bg-amber-50 border-amber-100', icon: <Clock size={16} /> },
    accepted: { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: <CheckCircle2 size={16} /> },
    rejected: { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: <XCircle size={16} /> },
    completed: { color: 'text-brand-olive bg-brand-olive/5 border-brand-olive/10', icon: <CheckCircle2 size={16} /> },
  };

  const currentStatus = statusInfo[trade.status] || statusInfo.pending;

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow border border-brand-ink/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-paper flex items-center justify-center text-brand-olive/40">
           <MessageCircle size={24} strokeWidth={1.5} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
             <h4 className="font-semibold text-lg">{trade.skillPostTitle}</h4>
             <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border flex items-center gap-1", currentStatus.color)}>
               {currentStatus.icon} {trade.status}
             </span>
          </div>
          <p className="text-brand-ink/60 text-sm italic">
            {isSender ? `You offered to trade with ${partnerName}` : `${trade.senderName} wants to trade with you`}
          </p>
          <div className="mt-3 p-3 bg-brand-paper rounded-xl text-sm italic text-brand-ink/70 max-w-lg border border-brand-ink/5">
            "{trade.proposalMessage}"
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-fit">
        {!isSender && trade.status === 'pending' && (
          <>
            <button 
              onClick={() => updateStatus('accepted')}
              className="bg-brand-olive text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 shadow-sm transition-all"
            >
              Accept
            </button>
            <button 
              onClick={() => updateStatus('rejected')}
              className="bg-white text-rose-600 border border-rose-100 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-rose-50 transition-all"
            >
              Decline
            </button>
          </>
        )}
        {trade.status === 'accepted' && (
           <button 
              onClick={() => updateStatus('completed')}
              className="bg-brand-olive text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
            >
              Mark Completed
           </button>
        )}
        {(trade.status === 'rejected' || trade.status === 'completed') && (
          <span className="text-xs font-bold text-brand-ink/20 uppercase tracking-widest italic">Closed Conversation</span>
        )}
      </div>
    </div>
  );
}

function CreatePostModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: User }) {
  const [formData, setFormData] = useState({ title: '', description: '', type: 'offer' as const, category: 'General' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'skillPosts'), {
        ...formData,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous Neighbor',
        active: true,
        createdAt: serverTimestamp()
      });
      onClose();
      setFormData({ title: '', description: '', type: 'offer', category: 'General' });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-brand-paper w-full max-w-xl rounded-4xl p-8 lg:p-10 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-olive/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <h2 className="text-4xl italic font-medium mb-6 relative">New Listing</h2>
            <form onSubmit={handleSubmit} className="space-y-6 relative">
              <div className="flex gap-4">
                {(['offer', 'request'] as const).map(t => (
                  <button 
                    key={t} type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-2xl text-sm font-bold uppercase tracking-widest border transition-all",
                      formData.type === t ? "bg-brand-olive text-white border-brand-olive shadow-md" : "bg-white text-brand-ink/40 border-brand-ink/10 hover:border-brand-ink/20"
                    )}
                  >
                    I'm {t === 'offer' ? 'Providing' : 'Looking'}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-ink/40">Listing Title</label>
                <input 
                  required
                  placeholder="e.g. Intermediate Guitar Tutoring"
                  className="w-full bg-white rounded-2xl p-4 shadow-sm outline-none border border-transparent focus:border-brand-olive/10 transition-all"
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-ink/40">Description & Expectations</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="What can you help with? What are you hoping for in return?"
                  className="w-full bg-white rounded-2xl p-4 shadow-sm outline-none border border-transparent focus:border-brand-olive/10 transition-all resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-ink/40">Category</label>
                <select 
                  className="w-full bg-white rounded-2xl p-4 shadow-sm outline-none border border-transparent focus:border-brand-olive/10 transition-all appearance-none"
                  value={formData.category}
                  onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                >
                  {['General', 'Tech', 'Music', 'Education', 'Home & Garden', 'Taxes & Finance', 'Health'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 bg-brand-olive text-white py-4 rounded-full font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 shadow-lg shadow-brand-olive/20 transition-all"
                >
                  {submitting ? 'Posting...' : 'Create Listing'}
                </button>
                <button type="button" onClick={onClose} className="px-8 font-semibold text-brand-ink/40 hover:text-brand-ink transition-colors">Cancel</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TradeRequestModal({ isOpen, onClose, post, currentUser }: { isOpen: boolean, onClose: () => void, post: SkillPost, currentUser: User }) {
  const [proposal, setProposal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'trades'), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Neighbor',
        receiverId: post.authorId,
        skillPostId: post.id,
        skillPostTitle: post.title,
        status: 'pending',
        proposalMessage: proposal,
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-brand-ink/50 backdrop-blur-sm" />
          <motion.div layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-brand-paper w-full max-w-lg rounded-4xl p-8 shadow-2xl">
            <h2 className="text-3xl font-medium italic mb-2">Trade Proposal</h2>
            <p className="text-brand-ink/60 text-sm mb-6">Proposing a trade for <span className="font-semibold text-brand-ink">{post.title}</span></p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-ink/40">Your Message</label>
                <textarea 
                  required
                  rows={4}
                  placeholder={`Hi ${post.authorName}, I saw your ${post.type}...`}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm outline-none border border-transparent focus:border-brand-olive/10 transition-all resize-none"
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 bg-brand-olive text-white py-4 rounded-full font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 shadow-lg"
                >
                  {submitting ? 'Sending...' : 'Send Proposal'}
                </button>
                <button type="button" onClick={onClose} className="px-6 text-brand-ink/40 hover:text-brand-ink font-semibold">Cancel</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ProfileView({ profile, user, userPosts }: { profile: UserProfile | null, user: User, userPosts: SkillPost[] }) {
  if (!profile) return null;
  return (
    <div className="space-y-12">
      <div className="relative">
        <div className="h-64 rounded-4xl bg-brand-olive/10 flex items-end p-10 overflow-hidden relative border border-brand-ink/5">
           <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-olive/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
           <div className="flex items-center gap-8 relative z-10">
              <div className="w-32 h-32 rounded-3xl bg-white shadow-xl flex items-center justify-center text-brand-olive/20 overflow-hidden">
                {profile.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon size={64} />}
              </div>
              <div>
                <h2 className="text-6xl font-medium italic mb-2">{profile.displayName}</h2>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-brand-ink/50 font-medium bg-white px-3 py-1 rounded-full text-sm">
                    <MapPin size={14} /> Neighbor
                  </span>
                  <span className="text-brand-ink/30 text-sm italic">{profile.email}</span>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-8">
           <div className="bg-white p-6 rounded-3xl card-shadow border border-brand-ink/5">
              <h3 className="text-xl font-bold uppercase tracking-widest text-brand-ink/30 mb-6 flex items-center gap-2">
                <Handshake size={18} /> My Reputation
              </h3>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-brand-ink/5">
                <span className="text-brand-ink/60 font-medium">Community Member Since</span>
                <span className="font-bold">2026</span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span className="text-brand-ink/60">Traded Skills</span>
                <span className="text-brand-olive font-bold">0</span>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl card-shadow border border-brand-ink/5">
              <h3 className="text-xl font-bold uppercase tracking-widest text-brand-ink/30 mb-4">Bio</h3>
              <p className="text-brand-ink/60 leading-relaxed italic">
                {profile.bio || "No bio yet. Tell your neighbors a bit about yourself!"}
              </p>
           </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-3xl font-medium italic">My Active Listings</h3>
            <span className="text-brand-ink/30 font-bold uppercase tracking-widest text-xs">{userPosts.length} post{userPosts.length !== 1 ? 's' : ''}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userPosts.map(post => (
              <div key={post.id} className="bg-white p-5 rounded-2xl card-shadow border border-brand-ink/5 group">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border", post.type === 'offer' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100")}>{post.type}ing</span>
                  <span className="text-[10px] text-brand-ink/30 italic font-medium">{post.category}</span>
                </div>
                <h4 className="font-semibold text-lg mb-1 group-hover:text-brand-olive transition-colors">{post.title}</h4>
                <p className="text-brand-ink/50 text-xs line-clamp-2">{post.description}</p>
              </div>
            ))}
            {userPosts.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-brand-ink/10 rounded-2xl">
                 <p className="text-brand-ink/30 italic">You haven't listed any skills yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
