import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, Timestamp, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Plus, Trash2, ArrowRight, X, Quote, Heart, Sparkles, Star, Check, RotateCcw, Download, Instagram, Crown, MessageCircle } from 'lucide-react';

// --- 🔑 重要：ここをご自身のFirebase設定（19.04.14.jpgの内容）に書き換えてください ---
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

const CATEGORIES = [
  { id: 'all', label: 'すべて', bg: 'bg-[#1a1a1a]', border: 'border-stone-800', lightBg: 'bg-stone-50', text: 'text-stone-800' },
  { id: 'baby', label: '0〜1歳', bg: 'bg-[#e94e38]', border: 'border-[#e94e38]', lightBg: 'bg-[#fff5f4]', text: 'text-[#e94e38]' },
  { id: 'toddler', label: '2〜3歳', bg: 'bg-[#0099cc]', border: 'border-[#0099cc]', lightBg: 'bg-[#f0f9ff]', text: 'text-[#0099cc]' },
  { id: 'pre', label: '4〜6歳', bg: 'bg-[#f39800]', border: 'border-[#f39800]', lightBg: 'bg-[#fff9e6]', text: 'text-[#f39800]' },
  { id: 'elementary', label: '小学生〜', bg: 'bg-[#34a853]', border: 'border-[#34a853]', lightBg: 'bg-[#f2faf5]', text: 'text-[#34a853]' },
];

const COLORS = ['#e94e38', '#0099cc', '#f39800', '#34a853', '#FFD100', '#8b5cf6'];

export default function App() {
  const [user, setUser] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isExporting, setIsExporting] = useState(null);
  const [displayCount, setDisplayCount] = useState(12);
  const [statusMessage, setStatusMessage] = useState('');
  const cardRefs = useRef({});

  // フォームの状態（エピソード context も含める）
  const [newQuote, setNewQuote] = useState({
    name: '', category: 'toddler', ageYears: '2', ageMonths: '0', content: '', meaning: '', context: ''
  });

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
      } catch (e) { console.error("Auth error:", e); }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const q = collection(db, 'quotes');
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setQuotes(data);
        }, (err) => console.error("Firestore error:", err));
        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleHeart = async (id, currentHearts = []) => {
    if (!user) return;
    const quoteRef = doc(db, 'quotes', id);
    const isHearted = (currentHearts || []).includes(user.uid);
    try {
      await updateDoc(quoteRef, {
        heartedBy: isHearted ? arrayRemove(user.uid) : arrayUnion(user.uid),
        heartCount: increment(isHearted ? -1 : 1)
      });
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showStatus('準備中...もう一度押してください');
      return;
    }
    // 入力チェック：名前、いいまつがい、意味は必須
    if (!newQuote.content || !newQuote.meaning || !newQuote.name) {
      showStatus('空欄（お名前・内容・意味）をうめてください！');
      return;
    }
    try {
      await addDoc(collection(db, 'quotes'), {
        ...newQuote, userId: user.uid, heartCount: 0, heartedBy: [], createdAt: Timestamp.now()
      });
      setNewQuote({ ...newQuote, content: '', meaning: '', context: '' });
      setIsModalOpen(false);
      showStatus('きろくしました！');
    } catch (e) { 
      console.error(e);
      showStatus('保存に失敗しました');
    }
  };

  const handleDownloadImage = async (id) => {
    if (!window.htmlToImage) return;
    const element = cardRefs.current[id];
    if (!element) return;
    setIsExporting(id);
    showStatus('生成中...');
    setTimeout(async () => {
      try {
        const dataUrl = await window.htmlToImage.toPng(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `iimatsugai-${id}.png`;
        link.href = dataUrl;
        link.click();
        showStatus('保存しました！');
      } catch (err) { showStatus('失敗'); } finally { setIsExporting(null); }
    }, 500);
  };

  const showStatus = (msg) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(''), 3000); };

  const filteredQuotes = useMemo(() => filter === 'all' ? quotes : quotes.filter(q => q.category === filter), [quotes, filter]);
  const visibleQuotes = useMemo(() => filteredQuotes.slice(0, displayCount), [filteredQuotes, displayCount]);
  const top10Quotes = useMemo(() => [...quotes].filter(q => (q.heartCount || 0) > 0).sort((a, b) => (b.heartCount || 0) - (a.heartCount || 0)).slice(0, 10), [quotes]);

  const QuoteCard = ({ quote, idx, isTop = false, isMini = false }) => {
    const catInfo = CATEGORIES.find(c => c.id === quote.category) || CATEGORIES[0];
    const isHearted = user && (quote.heartedBy || []).includes(user.uid);
    const isConfirming = deleteConfirmId === quote.id;
    return (
      <article ref={el => cardRefs.current[quote.id] = el}
        className={`relative flex flex-col bg-white border-t-[8px] transition-all duration-700 overflow-hidden rounded-[2.5rem] shadow-[15px_15px_0px_0px_rgba(0,0,0,0.02)] border-stone-100 group ${isExporting === quote.id ? 'exporting' : ''} ${catInfo.border.replace('border-', 'border-t-')}`}>
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none rounded-2xl ${catInfo.lightBg}`}></div>
        <div className={`flex flex-col h-full relative z-10 ${isMini ? 'p-6' : 'p-10 md:p-12'}`}>
          <div className="flex justify-between items-center mb-6">
            <div className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-white ${catInfo.bg}`}>{catInfo.label}</div>
            {isTop && <div className="flex items-center gap-1 text-[#FFD100]"><Crown className="w-4 h-4 fill-current" /><span className="text-[10px] font-black">TOP {idx + 1}</span></div>}
          </div>
          <div className="flex-1 mb-8">
            <div className="relative mb-6">
              <Quote className={`absolute -top-6 -left-6 w-12 h-10 opacity-10 ${catInfo.text}`} strokeWidth={3} />
              <h3 className={`font-black leading-snug tracking-widest text-black break-words ${isMini ? 'text-xl' : 'text-2xl md:text-4xl'}`}>{quote.content}</h3>
            </div>
            {quote.meaning && (
              <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${catInfo.lightBg} ${catInfo.border}`}>
                <ArrowRight className={`w-4 h-4 shrink-0 ${catInfo.text}`} strokeWidth={4} />
                <span className="font-black tracking-widest text-stone-800 leading-tight">{quote.meaning}</span>
              </div>
            )}
          </div>
          {/* エピソード表示 */}
          {!isMini && quote.context && <div className="mb-8 p-5 bg-stone-50/50 rounded-2xl border-l-4 border-stone-100 text-sm text-stone-500 tracking-wide leading-relaxed">{quote.context}</div>}
          
          <div className="pt-6 border-t border-stone-50 flex items-end justify-between">
            <div className="space-y-1"><span className="text-[10px] font-black text-stone-200 block uppercase tracking-widest">Name</span><span className="text-lg font-black tracking-widest text-stone-900 border-b-2 border-stone-100">{quote.name || 'ななしさん'}</span></div>
            <div className="text-right space-y-0.5">
              <div className="flex items-baseline justify-end gap-1 font-black text-xl tracking-tighter"><span className={catInfo.text}>{quote.ageYears}</span><span className="text-[12px] text-stone-200">歳</span><span className={`${catInfo.text} ml-1`}>{quote.ageMonths}</span><span className="text-[12px] text-stone-200">ヶ月</span></div>
              <div className="text-[10px] font-bold text-stone-200 uppercase tracking-widest">{quote.createdAt?.toDate().toLocaleDateString('ja-JP').replace(/\//g, '.')}</div>
            </div>
          </div>
          <div className="absolute top-5 right-5 flex flex-col gap-3 transition-opacity duration-300 opacity-0 group-hover:opacity-100 action-btn">
            {!isConfirming ? (
              <>
                <button onClick={() => handleHeart(quote.id, quote.heartedBy)} className={`w-11 h-11 rounded-full border flex flex-col items-center justify-center transition-all ${isHearted ? 'bg-rose-500 text-white border-transparent' : 'bg-white text-stone-300 hover:border-stone-400'}`}><Heart className={`w-4 h-4 ${isHearted ? 'fill-current' : ''}`} /><span className="text-[8px] font-black">{quote.heartCount || 0}</span></button>
                <button onClick={() => setDeleteConfirmId(quote.id)} className="w-10 h-10 bg-white rounded-full border text-stone-200 hover:text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                <button onClick={() => handleDownloadImage(quote.id)} className="w-10 h-10 bg-white rounded-full border text-stone-300 hover:text-rose-400 flex items-center justify-center"><Download className="w-4 h-4" /></button>
                <button onClick={() => { window.open('https://instagram.com', '_blank') }} className="w-10 h-10 bg-white rounded-full border text-stone-300 hover:text-fuchsia-500 flex items-center justify-center"><Instagram className="w-4 h-4" /></button>
              </>
            ) : (
              <div className="flex flex-col items-end gap-2 animate-in zoom-in-95"><span className="text-[10px] font-black bg-red-500 text-white px-2 py-1 rounded shadow-lg">消去?</span><div className="flex gap-2"><button onClick={() => { deleteDoc(doc(db, 'quotes', quote.id)); setDeleteConfirmId(null); showStatus('削除しました'); }} className="w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"><Check className="w-4 h-4" /></button><button onClick={() => setDeleteConfirmId(null)} className="w-9 h-9 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center shadow-md"><RotateCcw className="w-4 h-4" /></button></div></div>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] font-sans text-stone-800 pb-20 relative overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@900&family=Noto+Sans+JP:wght@400;700;900&display=swap');
        body { font-family: 'Noto Sans JP', sans-serif; }
        .exporting .action-btn { display: none !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .color-bar-frame { position: fixed; z-index: 100; display: flex; }
        .color-bar-top { top: 0; left: 0; right: 0; height: 8px; }
        .color-bar-bottom { bottom: 0; left: 0; right: 0; height: 8px; }
        .color-bar-left { top: 0; bottom: 0; left: 0; width: 8px; flex-direction: column; }
        .color-bar-right { top: 0; bottom: 0; right: 0; width: 8px; flex-direction: column; }
        .color-segment { flex: 1; }
        .title-char { display: inline-block; animation: titleFloat 4s ease-in-out infinite; }
        @keyframes titleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .fukidashi-tip { position: absolute; bottom: -12px; left: 40px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 14px solid #000; }
        .fukidashi-tip-inner { position: absolute; bottom: -9px; left: 40px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 14px solid #fff; }
        .animate-marquee { display: flex; width: max-content; animation: marquee 45s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>

      {/* 4辺カラーフレーム（20:20:17のデザイン） */}
      <div className="color-bar-frame color-bar-top">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      <div className="color-bar-frame color-bar-bottom">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      <div className="color-bar-frame color-bar-left">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      <div className="color-bar-frame color-bar-right">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      
      <header className="pt-24 pb-12 px-8 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="flex flex-col items-start">
          <h1 className="text-3xl md:text-4xl font-black tracking-[0.6em] text-black">{"いいまつがいじてん".split("").map((char, i) => <span key={i} className="title-char" style={{ animationDelay: `${i * 0.2}s` }}>{char}</span>)}</h1>
          <span className="text-[10px] font-black tracking-[0.4em] text-stone-200 mt-4 uppercase tracking-[0.6em]">Shared Heart Archive</span>
        </div>
        <div className="border-[2.5px] border-black rounded-[2.5rem] p-6 px-10 text-center bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,0.03)] relative"><p className="text-[9px] font-bold text-stone-400 mb-3 uppercase tracking-widest">Archive for Us</p><p className="text-base font-black tracking-widest">「たのしい成長」を</p><p className="text-base font-black mt-1 tracking-widest">のこしたい</p></div>
      </header>

      <div className="sticky top-0 z-40 bg-[#FCFAF7]/80 backdrop-blur-md border-y border-stone-100 shadow-sm"><div className="max-w-7xl mx-auto px-6 py-5 flex justify-center items-center gap-6"><span className="text-[10px] font-black tracking-widest text-stone-300 uppercase">絞り込み</span><nav className="flex gap-4 overflow-x-auto no-scrollbar">{CATEGORIES.map(cat => (<button key={cat.id} onClick={() => setFilter(cat.id)} className={`px-8 py-3 rounded-full text-xs font-black border-2 transition-all tracking-widest whitespace-nowrap ${filter === cat.id ? `${cat.bg} text-white border-transparent shadow-lg` : `text-stone-400 border-stone-100 hover:border-black hover:text-black`}`}>{cat.label}</button>))}</nav></div></div>

      <main className="max-w-7xl mx-auto px-8 py-20">
        <div className="mb-24 flex flex-col items-center md:items-start"><div className="relative inline-block"><div className="bg-white border-[2.5px] border-black rounded-[2.2rem] px-12 py-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.03)]"><h2 className="text-2xl font-black text-black flex items-center gap-6 tracking-widest"><Sparkles className="w-6 h-6 text-[#FFD100]" />あなたの大切な言葉を記録しよう</h2></div><div className="fukidashi-tip"></div><div className="fukidashi-tip-inner"></div></div></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">{visibleQuotes.map((quote, idx) => <QuoteCard key={quote.id} quote={quote} idx={idx} />)}</div>
        {filteredQuotes.length > displayCount && <div className="flex justify-center mt-20"><button onClick={() => setDisplayCount(prev => prev + 12)} className="bg-white border-2 border-stone-100 px-16 py-6 rounded-full font-black text-stone-400 hover:border-black hover:text-black transition-all tracking-widest">もっと見る</button></div>}
      </main>

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-12 right-12 w-24 h-24 bg-[#FF5A5F] text-white rounded-full flex flex-col items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 border-[6px] border-white"><Plus className="w-11 h-11" /><span className="text-[10px] font-black tracking-widest mt-1">追加する</span></button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xl flex items-center justify-center z-[60] p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl border-[3.5px] border-black rounded-[3rem] shadow-2xl my-auto">
            <div className="flex justify-between items-center border-b-2 p-10"><h2 className="text-2xl font-black tracking-widest uppercase">きろくをのこす</h2><button onClick={() => setIsModalOpen(false)} className="p-2 text-stone-300 hover:text-black transition-all"><X className="w-10 h-10" /></button></div>
            <form onSubmit={handleSubmit} className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="space-y-3"><label className="text-xs font-black text-stone-300 tracking-widest uppercase">時期</label><div className="grid grid-cols-2 gap-3">{CATEGORIES.filter(c => c.id !== 'all').map(cat => (<button key={cat.id} type="button" onClick={() => setNewQuote({...newQuote, category: cat.id})} className={`p-6 text-xs font-black border-2 rounded-2xl transition-all ${newQuote.category === cat.id ? `${cat.bg} text-white border-transparent shadow-md` : 'bg-white text-stone-300 border-stone-50 hover:border-stone-400'}`}>{cat.label}</button>))}</div></div>
                  <div className="space-y-3"><label className="text-xs font-black text-stone-300 tracking-widest uppercase">お名前</label><input type="text" placeholder="お名前" className="w-full border-b-2 p-4 text-xl font-black focus:border-[#FF5A5F] outline-none" value={newQuote.name} onChange={e => setNewQuote({...newQuote, name: e.target.value})} /></div>
                  <div className="space-y-3"><label className="text-xs font-black text-stone-300 tracking-widest uppercase">年齢</label><div className="flex items-center gap-4"><input type="number" className="w-20 border-b-2 p-4 text-xl font-black outline-none" value={newQuote.ageYears} onChange={e => setNewQuote({...newQuote, ageYears: e.target.value})} /><span>歳</span><input type="number" className="w-20 border-b-2 p-4 text-xl font-black outline-none" value={newQuote.ageMonths} onChange={e => setNewQuote({...newQuote, ageMonths: e.target.value})} /><span>ヶ月</span></div></div>
                </div>
                <div className="space-y-8">
                  <div className="space-y-3"><label className="text-xs font-black text-[#e94e38] tracking-widest uppercase">いいまつがい</label><textarea required placeholder="なんて言った？" className="w-full bg-stone-50 border-2 rounded-3xl p-8 text-2xl font-black focus:bg-white outline-none h-48 resize-none transition-all leading-relaxed" value={newQuote.content} onChange={e => setNewQuote({...newQuote, content: e.target.value})} /></div>
                  <div className="space-y-3"><label className="text-xs font-black text-[#0099cc] tracking-widest uppercase">ほんとうの意味</label><input required type="text" placeholder="ほんとうの意味" className="w-full border-b-2 p-4 text-xl font-black focus:border-[#0099cc] outline-none transition-colors" value={newQuote.meaning} onChange={e => setNewQuote({...newQuote, meaning: e.target.value})} /></div>
                  {/* エピソード（背景）欄を復活 */}
                  <div className="space-y-3"><label className="text-xs font-black text-stone-300 tracking-widest uppercase">エピソード（背景）</label><textarea placeholder="どんな時に言った？（任意）" className="w-full bg-stone-50 border-2 rounded-2xl p-4 text-sm font-medium focus:bg-white outline-none h-24 resize-none transition-all" value={newQuote.context} onChange={e => setNewQuote({...newQuote, context: e.target.value})} /></div>
                </div>
              </div>
              <button type="submit" className="w-full py-8 text-xl font-black bg-[#FF5A5F] text-white rounded-full shadow-xl hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest">きろくをのこす</button>
            </form>
          </div>
        </div>
      )}

      {statusMessage && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-8 py-3 rounded-full font-black text-sm tracking-widest shadow-2xl">{statusMessage}</div>}

      <footer className="pt-20 pb-40 bg-white border-t border-stone-50 text-center relative z-10">
        {top10Quotes.length > 0 && (
          <div className="mb-24 overflow-hidden"><div className="animate-marquee">{[...top10Quotes, ...top10Quotes].map((quote, i) => (<div key={`${quote.id}-${i}`} className="w-[350px] px-5"><QuoteCard quote={quote} idx={i % 10} isTop={true} isMini={true} /></div>))}</div></div>
        )}
        <p className="font-black text-stone-200 tracking-[1em] text-[10px] italic uppercase">Archiving the journey of love.</p>
        <p className="mt-10 font-black text-stone-400 text-xs tracking-widest uppercase">&copy; 2026 あそびラボ me-to</p>
      </footer>
    </div>
  );
}
