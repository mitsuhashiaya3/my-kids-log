import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, Timestamp, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Plus, Trash2, ArrowRight, X, Quote, Heart, Sparkles, Star, Check, RotateCcw, Download, Instagram, Crown } from 'lucide-react';

// --- Firebase 設定 ---
// Firebase コンソールで取得したあなた専用の内容をここに貼り付けてください
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
  const [formError, setFormError] = useState(false);
  const [isExporting, setIsExporting] = useState(null);
  const [displayCount, setDisplayCount] = useState(12);
  const [statusMessage, setStatusMessage] = useState('');
  const cardRefs = useRef({});

  const [newQuote, setNewQuote] = useState({
    name: '', category: 'toddler', ageYears: '2', ageMonths: '0', content: '', meaning: '', context: ''
  });

  // 画像保存ライブラリの読み込み
  useEffect(() => {
    if (window.htmlToImage) return;
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // 認証
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

  // データ取得
  useEffect(() => {
    if (!user) return;
    const quotesRef = collection(db, 'quotes');
    const unsubscribe = onSnapshot(quotesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setQuotes(data);
    }, (error) => console.error("Firestore error:", error));
    return () => unsubscribe();
  }, [user]);

  // いいね順の殿堂入り（エラー修正箇所：変数を定義）
  const top10Quotes = useMemo(() => {
    return [...quotes]
      .filter(q => (q.heartCount || 0) > 0)
      .sort((a, b) => (b.heartCount || 0) - (a.heartCount || 0))
      .slice(0, 10);
  }, [quotes]);

  const handleHeart = async (id, currentHearts = []) => {
    if (!user) return;
    const quoteRef = doc(db, 'quotes', id);
    const isHearted = (currentHearts || []).includes(user.uid);
    try {
      await updateDoc(quoteRef, {
        heartedBy: isHearted ? arrayRemove(user.uid) : arrayUnion(user.uid),
        heartCount: increment(isHearted ? -1 : 1)
      });
    } catch (error) { console.error("Heart error:", error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(newQuote.name && newQuote.content && newQuote.meaning)) {
      setFormError(true);
      return;
    }
    try {
      await addDoc(collection(db, 'quotes'), {
        ...newQuote, userId: user.uid, heartCount: 0, heartedBy: [], createdAt: Timestamp.now()
      });
      setNewQuote({ ...newQuote, content: '', meaning: '', context: '' });
      setFormError(false);
      setIsModalOpen(false);
      showStatus('記録しました！');
    } catch (error) { console.error("Save error:", error); }
  };

  const handleDownloadImage = async (id) => {
    if (!window.htmlToImage) {
      showStatus('準備中...');
      return;
    }
    const element = cardRefs.current[id];
    if (!element) return;
    setIsExporting(id);
    showStatus('生成中...');
    setTimeout(async () => {
      try {
        const dataUrl = await window.htmlToImage.toPng(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `iimatsugai_${id}.png`;
        link.href = dataUrl;
        link.click();
        showStatus('保存しました！');
      } catch (err) { showStatus('保存に失敗しました'); } finally { setIsExporting(null); }
    }, 500);
  };

  const showStatus = (msg) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(''), 3000); };

  const filteredQuotes = useMemo(() => filter === 'all' ? quotes : quotes.filter(q => q.category === filter), [quotes, filter]);
  const visibleQuotes = useMemo(() => filteredQuotes.slice(0, displayCount), [filteredQuotes, displayCount]);

  const QuoteCard = ({ quote, idx, isTop = false, isMini = false }) => {
    const catInfo = CATEGORIES.find(c => c.id === quote.category) || CATEGORIES[0];
    const isHearted = user && (quote.heartedBy || []).includes(user.uid);
    const isConfirming = deleteConfirmId === quote.id;
    return (
      <article ref={el => cardRefs.current[quote.id] = el}
        className={`relative flex flex-col bg-white border-t-[8px] transition-all duration-700 overflow-hidden rounded-2xl shadow-sm border-stone-100 ${isExporting === quote.id ? 'exporting' : ''} ${catInfo.border.replace('border-', 'border-t-')}`}>
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${catInfo.lightBg}`}></div>
        <div className={`flex flex-col h-full relative z-10 ${isMini ? 'p-5' : 'p-8 md:p-10'}`}>
          <div className="flex justify-between items-center mb-6">
            <div className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-white ${catInfo.bg}`}>{catInfo.label}</div>
            {isTop && <div className="flex items-center gap-1 text-[#FFD100]"><Crown className="w-4 h-4 fill-current" /><span className="text-[10px] font-black">上位 {idx + 1}位</span></div>}
          </div>
          <div className="flex-1 mb-8">
            <div className="relative mb-6">
              <Quote className={`absolute -top-6 -left-6 w-12 h-10 opacity-10 ${catInfo.text}`} strokeWidth={3} />
              <h3 className={`font-noto font-black leading-snug tracking-widest text-black break-words ${isMini ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{quote.content}</h3>
            </div>
            {quote.meaning && (
              <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${catInfo.lightBg} ${catInfo.border}`}>
                <ArrowRight className={`w-4 h-4 shrink-0 ${catInfo.text}`} strokeWidth={4} />
                <span className={`font-black tracking-widest text-stone-800 leading-tight ${isMini ? 'text-xs' : 'text-base'}`}>{quote.meaning}</span>
              </div>
            )}
          </div>
          {!isMini && quote.context && <div className="mb-10 p-5 bg-stone-50/50 rounded-2xl border-l-4 border-stone-100 font-noto text-sm text-stone-500 tracking-wide">{quote.context}</div>}
          <div className="pt-6 border-t border-stone-50 flex items-end justify-between font-noto">
            <div className="space-y-1"><span className="text-[10px] font-black text-stone-200 block uppercase tracking-widest">Record</span><span className="text-lg font-black tracking-widest text-stone-900 border-b-2 border-stone-100 truncate max-w-[120px] block">{quote.name || 'ななしさん'}</span></div>
            <div className="text-right space-y-0.5">
              <div className="flex items-baseline justify-end gap-1 font-black text-xl tracking-tighter"><span className={catInfo.text}>{quote.ageYears}</span><span className="text-[12px] text-stone-200">歳</span><span className={`${catInfo.text} ml-1`}>{quote.ageMonths}</span><span className="text-[12px] text-stone-200">ヶ月</span></div>
              <div className="text-[10px] font-bold text-stone-200 uppercase font-mono tracking-widest">{quote.createdAt?.toDate().toLocaleDateString('ja-JP').replace(/\//g, '.')}</div>
            </div>
          </div>
          <div className="absolute top-5 right-5 flex flex-col gap-3 action-btn">
            {!isConfirming ? (
              <>
                <button onClick={() => handleHeart(quote.id, quote.heartedBy)} className={`w-11 h-11 rounded-full border flex flex-col items-center justify-center transition-all ${isHearted ? 'bg-rose-500 text-white' : 'bg-white text-stone-300'}`}><Heart className={`w-4 h-4 ${isHearted ? 'fill-current' : ''}`} /><span className="text-[8px] font-black">{quote.heartCount || 0}</span></button>
                <button onClick={() => setDeleteConfirmId(quote.id)} className="w-10 h-10 bg-white rounded-full border text-stone-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                {!isMini && (
                  <button onClick={() => handleDownloadImage(quote.id)} className="w-10 h-10 bg-white rounded-full border text-stone-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-4 h-4" /></button>
                )}
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
    <div className="min-h-screen bg-[#FCFAF7] font-noto text-stone-800 pb-20 relative overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@900&family=Noto+Sans+JP:wght@400;700;900&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-noto { font-family: 'Noto Sans JP', sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .color-bar-frame { position: fixed; z-index: 100; display: flex; }
        .color-bar-top { top: 0; left: 0; right: 0; height: 6px; }
        .color-bar-bottom { bottom: 0; left: 0; right: 0; height: 6px; }
        .color-bar-left { top: 0; bottom: 0; left: 0; width: 6px; flex-direction: column; }
        .color-bar-right { top: 0; bottom: 0; right: 0; width: 6px; flex-direction: column; }
        .color-segment { flex: 1; }
        .editorial-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 2rem; }
        @media (min-width: 768px) { .editorial-grid { grid-template-columns: repeat(2, 1fr); gap: 2.5rem; } }
        @media (min-width: 1200px) { .editorial-grid { grid-template-columns: repeat(3, 1fr); gap: 3rem; } }
        .title-char { display: inline-block; animation: titleFloat 4s ease-in-out infinite; }
        @keyframes titleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .fukidashi-tip { position: absolute; bottom: -12px; left: 40px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 14px solid #000; }
        .fukidashi-tip-inner { position: absolute; bottom: -9px; left: 40px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 14px solid #fff; }
        .exporting .action-btn { display: none !important; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: flex; width: max-content; animation: marquee 45s linear infinite; }
      `}</style>

      {/* カラーバーフレーム */}
      <div className="color-bar-frame color-bar-top">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      <div className="color-bar-frame color-bar-bottom">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      <div className="color-bar-frame color-bar-left">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      <div className="color-bar-frame color-bar-right">{COLORS.map((c, i) => <div key={i} className="color-segment" style={{ backgroundColor: c }} />)}</div>
      
      <header className="pt-20 pb-12 px-8 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 font-noto">
        <div className="flex flex-col items-start">
          <h1 className="text-3xl md:text-4xl font-black tracking-[0.8em] text-black">{"いいまつがいじてん".split("").map((char, i) => <span key={i} className="title-char" style={{ animationDelay: `${i * 0.2}s` }}>{char}</span>)}</h1>
          <span className="text-[10px] font-black tracking-[0.4em] text-stone-200 mt-4 uppercase">Shared Heart Archive</span>
        </div>
        <div className="border-[2.5px] border-black rounded-[2rem] p-6 px-10 text-center bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,0.03)] relative"><p className="text-[9px] font-bold text-stone-400 mb-3 uppercase tracking-widest">Archive for Us</p><p className="text-base font-black tracking-widest">「たのしい成長」を</p><p className="text-base font-black mt-1 tracking-widest">のこしたい</p></div>
      </header>

      <div className="border-y border-stone-100 bg-white sticky top-0 z-40 shadow-sm font-noto"><div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-center"><nav className="flex items-center gap-4 overflow-x-auto no-scrollbar"><div className="text-[10px] font-black tracking-[0.3em] text-stone-300 pr-4">FILTER</div>{CATEGORIES.map(cat => (<button key={cat.id} onClick={() => { setFilter(cat.id); setDisplayCount(12); }} className={`px-8 py-3 rounded-full text-[12px] font-black border-2 transition-all tracking-widest ${filter === cat.id ? `${cat.bg} text-white border-transparent shadow-lg` : `text-stone-400 border-stone-100 hover:border-black hover:text-black`}`}>{cat.label}</button>))}</nav></div></div>

      <main className="max-w-7xl mx-auto px-8 py-24 font-noto">
        <div className="mb-24 flex flex-col items-center md:items-start"><div className="relative inline-block"><div className="bg-white border-[2.5px] border-black rounded-[2.2rem] px-12 py-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.03)]"><h2 className="text-2xl font-black text-black flex items-center gap-6 tracking-widest"><Sparkles className="w-6 h-6 text-[#FFD100]" />あなたの大切な言葉を記録しよう</h2></div><div className="fukidashi-tip"></div><div className="fukidashi-tip-inner"></div></div></div>
        
        {quotes.length === 0 ? <div className="py-40 text-center text-stone-200 font-black text-xl tracking-[0.5em] uppercase">No Memories Yet</div> : <div className="editorial-grid mb-40">{visibleQuotes.map((quote, idx) => <QuoteCard key={quote.id} quote={quote} idx={idx} />)}</div>}
        
        {filteredQuotes.length > displayCount && <div className="flex justify-center"><button onClick={() => setDisplayCount(prev => prev + 12)} className="bg-white border-2 border-stone-100 px-16 py-6 rounded-[2.5rem] font-black text-stone-400 hover:border-black hover:text-black transition-all shadow-sm tracking-widest uppercase">もっと見る</button></div>}
      </main>

      {statusMessage && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-8 py-3 rounded-full font-black text-sm tracking-widest shadow-2xl animate-in slide-in-from-top-10">{statusMessage}</div>}
      
      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-12 right-12 w-24 h-24 bg-[#FF5A5F] text-white rounded-full flex flex-col items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 border-[6px] border-white font-noto"><Plus className="w-11 h-11" /><span className="text-[10px] font-black mt-1 tracking-widest uppercase">追加する</span></button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xl flex items-center justify-center z-[60] p-6 font-noto">
          <div className="bg-white w-full max-w-4xl border-[3.5px] border-black rounded-[3.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="flex justify-between items-center border-b-2 p-12"><h2 className="text-3xl font-black text-black tracking-widest uppercase">New Record</h2><button onClick={() => setIsModalOpen(false)} className="p-5 text-stone-300 hover:text-black transition-all"><X className="w-12 h-12" /></button></div>
            <form onSubmit={handleSubmit} className="p-16 overflow-y-auto space-y-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                <div className="space-y-12">
                  <div className="space-y-4"><label className="text-[11px] font-black text-stone-300 uppercase tracking-widest">時期</label><div className="grid grid-cols-2 gap-4">{CATEGORIES.filter(c => c.id !== 'all').map(cat => (<button key={cat.id} type="button" onClick={() => setNewQuote({...newQuote, category: cat.id})} className={`p-8 text-[13px] font-black border-[3px] rounded-3xl transition-all ${newQuote.category === cat.id ? `${cat.bg} text-white border-transparent shadow-lg` : 'bg-white text-stone-300 border-stone-50 hover:border-stone-400'}`}>{cat.label}</button>))}</div></div>
                  <div className="space-y-4"><label className="text-[11px] font-black text-stone-300 uppercase tracking-widest">お名前</label><input type="text" placeholder="お子さまのお名前" className="w-full border-b-2 p-6 text-2xl font-black focus:border-[#FF5A5F] outline-none" value={newQuote.name} onChange={e => setNewQuote({...newQuote, name: e.target.value})} /></div>
                </div>
                <div className="space-y-12">
                  <div className="space-y-4"><label className="text-[12px] font-black text-[#e94e38] uppercase tracking-widest">いいまつがい</label><textarea required placeholder="なんて言った？" className="w-full bg-stone-50 border-[3px] rounded-[3rem] p-10 text-3xl font-black focus:bg-white outline-none h-56 resize-none leading-relaxed" value={newQuote.content} onChange={e => setNewQuote({...newQuote, content: e.target.value})} /></div>
                  <div className="space-y-4"><label className="text-[11px] font-black text-stone-300 uppercase tracking-widest">ほんとうの意味</label><input type="text" placeholder="意味..." className="w-full border-b-2 p-6 text-2xl font-black focus:border-[#0099cc] outline-none" value={newQuote.meaning} onChange={e => setNewQuote({...newQuote, meaning: e.target.value})} /></div>
                </div>
              </div>
              <div className="pt-10 flex justify-center"><button type="submit" className="px-56 py-11 text-2xl font-black bg-[#FF5A5F] text-white rounded-[3rem] shadow-2xl hover:brightness-110 active:scale-95 transition-all">きろくする</button></div>
            </form>
          </div>
        </div>
      )}

      <footer className="pt-20 pb-56 relative bg-white border-t border-stone-50 font-noto text-center">
        {top10Quotes.length > 0 && (
          <div className="relative z-20 mb-28">
            <div className="animate-marquee">
              {[...top10Quotes, ...top10Quotes].map((quote, i) => (<div key={`${quote.id}-${i}`} className="w-[300px] md:w-[380px] px-5"><QuoteCard quote={quote} idx={i % 10} isTop={true} isMini={true} /></div>))}
            </div>
          </div>
        )}
        <p className="font-inter text-[12px] tracking-[1.5em] text-stone-200 uppercase font-black italic">ARCHIVING THE JOURNEY OF LOVE.</p>
        <p className="mt-10 font-noto text-stone-400 text-xs font-black tracking-[0.5em] uppercase">&copy; 2026 あそびラボ me-to</p>
      </footer>
    </div>
  );
}
