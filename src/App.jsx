import ReactDOM from 'react-dom/client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, Timestamp, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Plus, Trash2, ArrowRight, X, Quote, Scissors, Heart, Smile, Sparkles, MessageCircle, Star, Check, RotateCcw, Download, Instagram, Crown, ChevronDown } from 'lucide-react';

// --- Firebase 設定 ---
// ここをご自身のFirebaseコンソールで取得した内容に書き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyBfmHKWKWKUdNu5oyUALH2W5fQGtHT7ShA",
  authDomain: "iimatsugai-jiten.firebaseapp.com",
  projectId: "iimatsugai-jiten",
  storageBucket: "iimatsugai-jiten.firebasestorage.app",
  messagingSenderId: "557117667985",
  appId: "1:557117667985:web:5b10a2f628fea55f525d30",
  measurementId: "G-SRSCQ4YTPE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "kids-quote-log";

const CATEGORIES = [
  { id: 'all', label: 'すべて', sub: 'ALL', color: '#1a1a1a', bg: 'bg-[#1a1a1a]', border: 'border-stone-800', lightBg: 'bg-stone-50', text: 'text-stone-800' },
  { id: 'baby', label: '0〜1歳', sub: 'BABY', color: '#e94e38', bg: 'bg-[#e94e38]', border: 'border-[#e94e38]', lightBg: 'bg-[#fff5f4]', text: 'text-[#e94e38]' },
  { id: 'toddler', label: '2〜3歳', sub: 'TODDLER', color: '#0099cc', bg: 'bg-[#0099cc]', border: 'border-[#0099cc]', lightBg: 'bg-[#f0f9ff]', text: 'text-[#0099cc]' },
  { id: 'pre', label: '4〜6歳', sub: 'KIDS', color: '#f39800', bg: 'bg-[#f39800]', border: 'border-[#f39800]', lightBg: 'bg-[#fff9e6]', text: 'text-[#f39800]' },
  { id: 'elementary', label: '小学生〜', sub: 'SCHOOL', color: '#34a853', bg: 'bg-[#34a853]', border: 'border-[#34a853]', lightBg: 'bg-[#f2faf5]', text: 'text-[#34a853]' },
];

const COLORS = ['#e94e38', '#0099cc', '#f39800', '#34a853', '#FFD100', '#8b5cf6'];

const XIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current">
    <path d="M18.244 2.25h3.308l-7.227 7.719 8.502 11.281h-6.657l-5.203-6.817-5.967 6.817H1.611l7.73-8.256L1.145 2.25h6.828l4.695 6.148L18.244 2.25Z"></path>
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [formError, setFormError] = useState(false);
  const [isExporting, setIsExporting] = useState(null);
  const [displayCount, setDisplayCount] = useState(12);
  const [statusMessage, setStatusMessage] = useState('');
  
  const cardRefs = useRef({});

  const [newQuote, setNewQuote] = useState({
    name: '',
    category: 'toddler',
    ageYears: '2',
    ageMonths: '0',
    content: '',
    meaning: '',
    context: ''
  });

  // html-to-imageを動的に読み込み
  useEffect(() => {
    if (window.htmlToImage) return;
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const quotesRef = collection(db, 'quotes');
    const unsubscribe = onSnapshot(quotesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setQuotes(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleHeart = async (id, currentHearts = []) => {
    if (!user) return;
    const quoteRef = doc(db, 'quotes', id);
    const isHearted = (currentHearts || []).includes(user.uid);
    try {
      await updateDoc(quoteRef, {
        heartedBy: isHearted ? arrayRemove(user.uid) : arrayUnion(user.uid),
        heartCount: increment(isHearted ? -1 : 1)
      });
    } catch (error) {
      console.error("Heart error:", error);
    }
  };

  const top10Quotes = useMemo(() => {
    return [...quotes]
      .filter(q => (q.heartCount || 0) > 0)
      .sort((a, b) => (b.heartCount || 0) - (a.heartCount || 0))
      .slice(0, 10);
  }, [quotes]);

  const isFormValid = newQuote.name && newQuote.content && newQuote.meaning && newQuote.context;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      setFormError(true);
      return;
    }
    try {
      const quotesRef = collection(db, 'quotes');
      await addDoc(quotesRef, {
        ...newQuote,
        userId: user.uid,
        heartCount: 0,
        heartedBy: [],
        createdAt: Timestamp.now()
      });
      setNewQuote({ ...newQuote, content: '', meaning: '', context: '' });
      setFormError(false);
      setIsModalOpen(false);
      showStatus('記録しました！');
    } catch (error) {
      console.error("Error adding quote:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'quotes', id));
      setDeleteConfirmId(null);
      showStatus('削除しました');
    } catch (error) {
      console.error("Error deleting quote:", error);
    }
  };

  const handleXShare = (quote) => {
    const text = `#いいまつがいじてん に、いいまつがいを投稿しました！\n\n「${quote.content}」\n（意味：${quote.meaning}）\n`;
    const url = window.location.href;
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(xUrl, '_blank');
  };

  const handleDownloadImage = async (id) => {
    if (!window.htmlToImage) {
      showStatus('ライブラリを読み込み中です。数秒後にもう一度お試しください。');
      return;
    }
    const element = cardRefs.current[id];
    if (!element) return;

    setIsExporting(id);
    showStatus('画像を生成中...');

    setTimeout(async () => {
      try {
        const dataUrl = await window.htmlToImage.toPng(element, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          style: {
            transform: 'scale(1)',
            borderRadius: '1.5rem'
          }
        });
        const link = document.createElement('a');
        link.download = `いいまつがいじてん_${id}.png`;
        link.href = dataUrl;
        link.click();
        showStatus('画像を保存しました！');
      } catch (err) {
        console.error('Image export failed', err);
        showStatus('保存に失敗しました');
      } finally {
        setIsExporting(null);
      }
    }, 300);
  };

  const showStatus = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const filteredQuotes = useMemo(() => {
    return filter === 'all' ? quotes : quotes.filter(q => q.category === filter);
  }, [quotes, filter]);

  const visibleQuotes = useMemo(() => {
    return filteredQuotes.slice(0, displayCount);
  }, [filteredQuotes, displayCount]);

  const titleChars = "いいまつがいじてん".split("");

  const QuoteCard = ({ quote, idx, isTop = false, isMini = false }) => {
    const catInfo = CATEGORIES.find(c => c.id === quote.category) || CATEGORIES[0];
    const isConfirming = deleteConfirmId === quote.id;
    const isHearted = user && (quote.heartedBy || []).includes(user.uid);
    
    return (
      <article 
        ref={el => cardRefs.current[quote.id] = el}
        className={`relative group flex flex-col bg-white border-t-[8px] transition-all duration-700 hover:shadow-2xl hover:translate-y-[-5px] overflow-hidden rounded-2xl shadow-sm border-stone-100 page-flip-enter ${isExporting === quote.id ? 'exporting' : ''} ${catInfo.border.replace('border-', 'border-t-')}`}
        style={{ animationDelay: `${idx * 0.05}s` }}
      >
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${catInfo.lightBg}`}></div>

        <div className={`flex flex-col h-full relative z-10 ${isMini ? 'p-5' : 'p-8 md:p-12'}`}>
          <div className="flex justify-between items-center mb-8">
            <div className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-white shadow-sm ${catInfo.bg}`}>
              {catInfo.label}
            </div>
            {isTop && (
               <div className="flex items-center gap-1 text-[#FFD100]">
                 <Crown className="w-4 h-4 fill-current" />
                 <span className="text-[10px] font-black tracking-widest">上位 {idx + 1}位</span>
               </div>
            )}
          </div>

          <div className="flex-1 mb-10">
            <div className="relative mb-8">
              <Quote className={`absolute -top-6 -left-6 w-12 h-10 opacity-10 ${catInfo.text}`} strokeWidth={3} />
              <h3 className={`font-noto font-black leading-snug tracking-wider text-black break-words group-hover:text-stone-700 transition-colors ${isMini ? 'text-xl' : 'text-2xl md:text-4xl'}`}>
                {quote.content}
              </h3>
            </div>

            {quote.meaning && (
              <div className={`p-5 rounded-2xl border-2 flex items-center gap-4 ${catInfo.lightBg} ${catInfo.border} transition-all group-hover:bg-white shadow-sm`}>
                <ArrowRight className={`w-5 h-5 shrink-0 ${catInfo.text}`} strokeWidth={4} />
                <span className={`font-black tracking-wide text-stone-800 leading-tight font-noto ${isMini ? 'text-sm' : 'text-lg'}`}>
                  {quote.meaning}
                </span>
              </div>
            )}
          </div>

          {!isMini && quote.context && (
            <div className="mb-12 p-6 bg-stone-50/50 rounded-2xl border-l-4 border-stone-200 font-noto text-[15px] font-medium leading-relaxed text-stone-500 tracking-wide">
              {quote.context}
            </div>
          )}

          <div className="pt-8 border-t border-stone-50 flex items-end justify-between font-noto">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-stone-200 uppercase block font-inter">Record</span>
              <span className="text-xl font-black tracking-tight text-stone-900 border-b-2 border-stone-100 font-noto truncate max-w-[150px] block">{quote.name || 'ななしさん'}</span>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-baseline justify-end gap-1.5 font-black text-2xl tracking-tighter">
                <span className={catInfo.text}>{quote.ageYears}</span>
                <span className="text-[12px] text-stone-200 font-noto uppercase">歳</span>
                <span className={`${catInfo.text} ml-1`}>{quote.ageMonths}</span>
                <span className="text-[12px] text-stone-200 font-noto uppercase">ヶ月</span>
              </div>
              <div className="text-[11px] font-bold text-stone-200 tracking-widest uppercase font-mono mt-1">
                {quote.createdAt?.toDate().toLocaleDateString('ja-JP').replace(/\//g, '.')}
              </div>
            </div>
          </div>

          <div className="absolute top-5 right-5 flex flex-col gap-3 action-btn">
            {!isConfirming ? (
              <>
                <button onClick={() => handleHeart(quote.id, quote.heartedBy)} className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center shadow-sm transition-all group/heart ${isHearted ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-stone-100 text-stone-300 hover:text-rose-500'}`}>
                  <Heart className={`w-5 h-5 ${isHearted ? 'fill-current' : 'group-hover/heart:fill-current'}`} />
                  <span className="text-[8px] font-black leading-none mt-1">{quote.heartCount || 0}</span>
                </button>
                <button onClick={() => setDeleteConfirmId(quote.id)} className="w-10 h-10 bg-white rounded-full border border-stone-100 flex items-center justify-center text-stone-200 hover:text-red-500 shadow-sm transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                {!isMini && (
                  <>
                    <button onClick={() => handleXShare(quote)} className="w-10 h-10 bg-white rounded-full border border-stone-100 flex items-center justify-center text-stone-300 hover:text-stone-900 shadow-sm transition-all opacity-0 group-hover:opacity-100 delay-75"><XIcon /></button>
                    <button onClick={() => handleDownloadImage(quote.id)} className="w-10 h-10 bg-white rounded-full border border-stone-100 flex items-center justify-center text-stone-300 hover:text-rose-400 shadow-sm transition-all opacity-0 group-hover:opacity-100 delay-150"><Download className="w-4 h-4" /></button>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-end gap-2 animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[10px] font-black bg-red-500 text-white px-2 py-1 rounded shadow-lg">本当に消す？</span>
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(quote.id)} className="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirmId(null)} className="w-9 h-9 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"><RotateCcw className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] font-noto text-stone-800 pb-20 relative overflow-x-hidden">
      <div className="color-bar-frame color-bar-top"> {COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)} </div>
      <div className="color-bar-frame color-bar-bottom"> {COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)} </div>
      <div className="color-bar-frame color-bar-left"> {COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)} </div>
      <div className="color-bar-frame color-bar-right"> {COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)} </div>
      
      <header className="pt-16 pb-10 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-14">
          <div className="flex flex-col text-black">
            <h1 className="text-3xl md:text-4xl font-black tracking-[0.8em] leading-tight select-none ml-2">
              {titleChars.map((char, i) => (
                <span key={i} className="title-char" style={{ animationDelay: `${i * 0.2}s` }}>{char}</span>
              ))}
            </h1>
            <div className="flex items-center gap-2 mt-4 ml-2">
              <span className="text-[10px] font-black tracking-[0.5em] uppercase text-stone-200 font-inter uppercase">Shared Heart Archive</span>
            </div>
          </div>
          <div className="hidden lg:flex flex-col border-l-2 border-stone-100 pl-10 py-1">
            <p className="font-inter text-[10px] font-black tracking-[0.5em] uppercase text-stone-300 mb-1.5">Volume / 01</p>
            <p className="text-base font-bold text-stone-500 tracking-[0.2em]">愛しき言い間違いの記録</p>
          </div>
        </div>
        <div className="relative group w-full md:w-auto max-w-[200px]">
          <div className="border-[2.5px] border-black rounded-[2rem] p-6 text-center bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,0.03)] transition-all group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none relative overflow-hidden">
            <p className="text-[9px] font-bold tracking-[0.2em] text-stone-400 mb-2 uppercase italic">Archive for Us</p>
            <p className="text-base font-black tracking-tighter leading-tight">「たのしい成長」を</p>
            <p className="text-base font-black tracking-tighter leading-tight mt-0.5">のこしたい</p>
          </div>
        </div>
      </header>

      <div className="border-y border-stone-100 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-center">
          <nav className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            <div className="text-[10px] font-black tracking-[0.3em] text-stone-300 uppercase pr-6 border-r border-stone-100 mr-2 shrink-0">FILTER</div>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setFilter(cat.id); setDeleteConfirmId(null); setDisplayCount(12); }}
                className={`px-8 py-3 rounded-full text-[12px] font-black border-2 transition-all shrink-0 flex items-center gap-3 tracking-widest ${
                  filter === cat.id 
                    ? `${cat.bg} border-transparent text-white shadow-md translate-y-[-1px]` 
                    : `bg-transparent border-stone-100 text-stone-400 hover:border-stone-800 hover:text-stone-800`
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${cat.bg} shadow-sm ${filter === cat.id ? 'bg-white' : ''}`} />
                {cat.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-24 flex flex-col items-center md:items-start group">
          <div className="relative inline-block">
            <div className="bg-white border-[2.5px] border-black rounded-[2.2rem] px-12 py-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.03)] transition-transform group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none text-center md:text-left">
              <h2 className="text-2xl font-black tracking-widest leading-tight text-black flex items-center justify-center md:justify-start gap-6">
                <Sparkles className="w-6 h-6 text-[#FFD100]" />
                あなたの大切な言葉を記録しよう
              </h2>
            </div>
            <div className="fukidashi-tip"></div>
            <div className="fukidashi-tip-inner"></div>
          </div>
        </div>

        {filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-64 bg-white rounded-[3rem] border-2 border-dashed border-stone-200">
            <MessageCircle className="w-16 h-16 mb-8 text-stone-100" />
            <p className="text-2xl text-stone-200 tracking-[0.4em] uppercase font-black">Dictionary is empty</p>
          </div>
        ) : (
          <>
            <div className="editorial-grid mb-40">
              {visibleQuotes.map((quote, idx) => (
                <QuoteCard key={quote.id} quote={quote} idx={idx} />
              ))}
            </div>
            
            {filteredQuotes.length > displayCount && (
              <div className="mt-20 flex justify-center">
                <button 
                  onClick={() => setDisplayCount(prev => prev + 12)}
                  className="group flex flex-col items-center gap-3 bg-white border-2 border-stone-100 px-16 py-6 rounded-[2.5rem] hover:border-black transition-all shadow-sm active:scale-95"
                >
                  <span className="text-sm font-black tracking-[0.4em] text-stone-400 group-hover:text-black">もっと見る</span>
                  <ChevronDown className="w-6 h-6 text-stone-200 animate-bounce group-hover:text-black" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {statusMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-8 py-3 rounded-full font-black text-sm tracking-widest shadow-2xl animate-in slide-in-from-top-10 duration-300">
          {statusMessage}
        </div>
      )}

      <button 
        onClick={() => { setIsModalOpen(true); setDeleteConfirmId(null); setFormError(false); }}
        className="fixed bottom-12 right-12 w-24 h-24 bg-[#FF5A5F] text-white rounded-full flex flex-col items-center justify-center shadow-[20px_20px_40px_rgba(255,90,95,0.2)] hover:scale-110 active:scale-95 transition-all z-50 group border-[6px] border-white overflow-hidden"
      >
        <Plus className="w-11 h-11 transition-transform group-hover:rotate-180 duration-700 relative z-10" />
        <span className="text-[10px] font-black tracking-widest uppercase mt-1 relative z-10 font-noto uppercase">追加する</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xl flex items-center justify-center z-[60] p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl border-[3.5px] border-black rounded-[3.5rem] shadow-2xl animate-in slide-in-from-bottom-20 duration-500 flex flex-col max-h-[92vh] overflow-hidden font-noto">
            <div className="flex justify-between items-center border-b-2 border-stone-100 p-12 bg-stone-50/40">
                <div className="flex items-center gap-10">
                  <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-xl">
                    <Star className="w-7 h-7 text-[#FFD100] fill-[#FFD100]" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-widest uppercase text-black">新規きろく</h2>
                    <p className="text-[11px] tracking-[0.5em] font-black text-stone-300 mt-2 uppercase">Saving a fragment of love</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-white rounded-full border-2 border-transparent transition-all p-5 text-stone-300 hover:text-black">
                  <X className="w-12 h-12" />
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-16 overflow-y-auto custom-scrollbar space-y-16">
              {formError && <div className="bg-red-500 text-white p-8 rounded-2xl font-black text-center animate-in slide-in-from-top-4 duration-300 shadow-xl tracking-widest">すべての項目を入力してください！</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                <div className="space-y-12 text-black">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.5em] text-stone-300 border-l-4 border-[#FF5A5F] pl-4">時期</label>
                    <div className="grid grid-cols-2 gap-4">
                      {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                        <button key={cat.id} type="button" onClick={() => setNewQuote({...newQuote, category: cat.id})} className={`p-8 text-[13px] font-black tracking-widest border-[3px] rounded-3xl transition-all flex flex-col items-center ${newQuote.category === cat.id ? `${cat.bg} text-white border-transparent shadow-lg` : 'bg-white text-stone-300 border-stone-50 hover:border-stone-400'}`}>{cat.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.5em] text-stone-300 border-l-4 border-stone-200 pl-4">年齢</label>
                    <div className="flex gap-4">
                      <div className="flex-1 relative">
                        <select className="w-full bg-stone-50 border-2 border-stone-100 rounded-xl p-7 text-xl font-black focus:border-black outline-none appearance-none text-black tracking-widest" value={newQuote.ageYears} onChange={e => setNewQuote({...newQuote, ageYears: e.target.value})}>{[...Array(13)].map((_, i) => <option key={i} value={i}>{i} 歳</option>)}</select>
                      </div>
                      <div className="flex-1 relative">
                        <select className="w-full bg-stone-50 border-2 border-stone-100 rounded-xl p-7 text-xl font-black focus:border-black outline-none appearance-none text-black tracking-widest" value={newQuote.ageMonths} onChange={e => setNewQuote({...newQuote, ageMonths: e.target.value})}>{[...Array(12)].map((_, i) => <option key={i} value={i}>{i} ヶ月</option>)}</select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.5em] text-stone-300 border-l-4 border-stone-200 pl-4">お名前</label>
                    <input type="text" placeholder="お子さまのお名前" className="w-full bg-transparent border-b-2 border-stone-100 p-6 text-2xl font-black focus:border-[#FF5A5F] outline-none transition-all placeholder:text-stone-100 text-black tracking-widest" value={newQuote.name} onChange={e => setNewQuote({...newQuote, name: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-12 text-black">
                  <div className="space-y-4">
                    <label className="text-[12px] font-black uppercase tracking-[0.5em] text-[#e94e38] border-l-4 border-[#e94e38] pl-5">いいまつがい</label>
                    <textarea required placeholder="なんて言った？" className="w-full bg-stone-50 border-[3px] border-stone-100 rounded-[3rem] p-10 text-3xl font-black focus:border-black focus:bg-white outline-none h-56 resize-none leading-relaxed tracking-wider text-black" value={newQuote.content} onChange={e => setNewQuote({...newQuote, content: e.target.value})} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.5em] text-stone-300 border-l-4 border-[#0099cc] pl-4">ほんとうの意味</label>
                    <input type="text" placeholder="ほんとうの意味..." className="w-full bg-white border-b-2 border-stone-100 p-6 text-2xl font-black focus:border-[#0099cc] outline-none placeholder:text-stone-100 text-black tracking-widest" value={newQuote.meaning} onChange={e => setNewQuote({...newQuote, meaning: e.target.value})} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.5em] text-stone-300 border-l-4 border-stone-100 pl-4">エピソード</label>
                    <textarea placeholder="どんなときに言った？" className="w-full bg-stone-50 border-[3px] border-stone-100 rounded-3xl p-8 text-base font-bold focus:bg-white focus:border-black outline-none h-24 resize-none leading-relaxed tracking-wider" value={newQuote.context} onChange={e => setNewQuote({...newQuote, context: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="pt-10 flex justify-center">
                <button type="submit" disabled={!isFormValid} className={`px-56 py-11 text-2xl font-black tracking-[0.6em] transition-all uppercase rounded-[3rem] shadow-2xl ${isFormValid ? 'bg-[#FF5A5F] text-white hover:bg-[#ff4146] translate-y-[-4px]' : 'bg-stone-100 text-stone-300 cursor-not-allowed'}`}>きろくする</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- フッター --- */}
      <footer className="pt-20 pb-56 relative bg-white overflow-hidden border-t border-stone-50">
        <div className="relative z-10 text-center select-none pointer-events-none opacity-[0.08] mb-[-6vw]">
          <h2 className="text-[18vw] font-noto font-black italic tracking-widest leading-none uppercase text-stone-900">LOVE <span className="text-stone-500">&</span> SMILE</h2>
        </div>
        {top10Quotes.length > 0 && (
          <div className="relative z-20 mb-24 md:mb-36">
            <div className="animate-marquee">
              {[...top10Quotes, ...top10Quotes].map((quote, i) => (
                <div key={`${quote.id}-${i}`} className="w-[280px] md:w-[350px] px-4"><QuoteCard quote={quote} idx={i % 10} isTop={true} isMini={true} /></div>
              ))}
            </div>
          </div>
        )}
        <div className="relative z-30 flex flex-col items-center gap-16">
           <div className="flex flex-col items-center gap-10 bg-white/90 backdrop-blur-sm p-12 rounded-[3rem] border border-stone-50 shadow-sm">
             <a href="https://www.instagram.com/asobi_labo_me_to/?hl=ja" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-stone-50 px-8 py-4 rounded-full hover:bg-[#FF5A5F] hover:text-white transition-all group shadow-sm border border-stone-100 font-inter font-black tracking-widest"><Instagram className="w-6 h-6 group-hover:scale-110 transition-transform" />asobi_labo_me_to</a>
             <div className="flex flex-col items-center">
                <div className="w-16 h-1 bg-[#FFD100] rounded-full mb-8 opacity-50"></div>
                <p className="font-noto text-stone-400 text-[12px] font-black tracking-[0.4em] uppercase">&copy; 2026 あそびラボ me-to</p>
             </div>
           </div>
           <p className="font-inter text-[12px] tracking-[1.8em] text-stone-200 uppercase font-black leading-relaxed italic max-w-3xl px-8 text-center">ARCHIVING THE JOURNEY OF LOVE.</p>
        </div>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
