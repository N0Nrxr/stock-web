import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Clock, Activity, BarChart2, AlertCircle, Bell, Pin, ChevronUp, ChevronDown, Trash2, Lock, LogIn, Menu, X, Settings, LogOut, Newspaper, ExternalLink, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// นำเข้า Firebase Authentication และ Firestore
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function App() {
  // --- ส่วนจัดการ State ของระบบ Firebase Auth ---
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // State สำหรับเปิด-ปิด Hamburger Menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- State สำหรับส่วนข่าวสาร (กรอบที่ 4) ---
  const [newsList, setNewsList] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // 1. ตรวจสอบสถานะการล็อกอินของผู้ใช้แบบ Real-time
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'user_stocks', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.pinnedSymbols) setPinnedSymbols(data.pinnedSymbols);
          if (data.alerts) setAlerts(data.alerts);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        await setDoc(doc(db, 'user_stocks', userCredential.user.uid), {
          pinnedSymbols: pinnedSymbols,
          alerts: alerts,
          createdAt: new Date()
        });
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const syncDataToCloud = async (newPinned, newAlerts) => {
    if (user) {
      try {
        const docRef = doc(db, 'user_stocks', user.uid);
        await setDoc(docRef, { 
          pinnedSymbols: newPinned,
          alerts: newAlerts,
          updatedAt: new Date()
        }, { merge: true });
      } catch (err) {
        console.error("Error syncing to cloud:", err);
      }
    }
  };

  // --- โค้ดเดิมของแอปพลิเคชันหุ้น ---
  const [searchInput, setSearchInput] = useState('NVDA');
  const [currentSymbol, setCurrentSymbol] = useState('NVDA');
  const [currentStock, setCurrentStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('1D');
  
  const [apiKey, setApiKey] = useState(localStorage.getItem('finnhub_key') || '');
  const [isRealtime, setIsRealtime] = useState(!!localStorage.getItem('finnhub_key'));
  
  const USD_TO_THB = 33.52;

  const formatNumber = (num, decimals = 2) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const [pinnedSymbols, setPinnedSymbols] = useState(() => {
    try {
      const saved = localStorage.getItem('pinned_stocks');
      return saved ? JSON.parse(saved) : ['NVDA', 'AAPL', 'TSLA', 'PTT.BK'];
    } catch (e) {
      return ['NVDA', 'AAPL', 'TSLA', 'PTT.BK'];
    }
  });

  const suggestedStocks = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'PTT.BK', 'CPALL.BK'];

  const [watchlistData, setWatchlistData] = useState({});

  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('stock_alerts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  
  const [alertMode, setAlertMode] = useState('above');
  const [targetAboveInput, setTargetAboveInput] = useState('');
  const [targetBelowInput, setTargetBelowInput] = useState('');
  const [alertTriggeredMessage, setAlertTriggeredMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState('');

  const stockDomains = {
    'NVDA': 'nvidia.com',
    'AAPL': 'apple.com',
    'TSLA': 'tesla.com',
    'MSFT': 'microsoft.com',
    'GOOGL': 'google.com',
    'PTT.BK': 'pttplc.com',
    'CPALL.BK': 'cpall.co.th',
    'AMZN': 'amazon.com',
    'META': 'meta.com',
    'NFLX': 'netflix.com'
  };

  const getStockLogoUrl = (sym) => {
    const domain = stockDomains[sym] || `${sym.toLowerCase().replace('.bk', '')}.com`;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  };

  useEffect(() => {
    localStorage.setItem('stock_alerts', JSON.stringify(alerts));
    syncDataToCloud(pinnedSymbols, alerts);
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem('pinned_stocks', JSON.stringify(pinnedSymbols));
    syncDataToCloud(pinnedSymbols, alerts);
  }, [pinnedSymbols]);

  useEffect(() => {
    if (!isRealtime || !apiKey) return;
    
    const alertSymbols = Object.keys(alerts);
    const allSymbolsToFetch = Array.from(new Set([...pinnedSymbols, ...suggestedStocks, ...alertSymbols, currentSymbol]));
    
    allSymbolsToFetch.forEach(async (sym) => {
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`);
        const data = await res.json();
        if (data && data.c !== undefined && data.c !== 0) {
          setWatchlistData(prev => ({
            ...prev,
            [sym]: { price: data.c, change: data.d, percentChange: data.dp }
          }));
          checkPriceAlert(sym, data.c);
        }
      } catch (err) {
        console.error(`Error fetching quote for ${sym}`, err);
      }
    });
  }, [isRealtime, apiKey, pinnedSymbols, currentSymbol, alerts]);

  // --- ฟังก์ชันดึงข่าวและแปลภาษาไทย (กรอบที่ 4) ---
  const translateText = async (text) => {
    if (!text) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=th&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data[0]) {
        return data[0].map(item => item[0]).join('');
      }
      return text;
    } catch (e) {
      return text;
    }
  };

  const fetchStockNews = async (symbol) => {
    if (!isRealtime || !apiKey) {
      setNewsList([]);
      return;
    }

    setNewsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const cleanSymbol = symbol.replace('.BK', '');
      const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${cleanSymbol}&from=${pastDate}&to=${today}&token=${apiKey}`);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const rawNews = data.slice(0, 5); // ดึง 5 ข่าวล่าสุด

        // ทำการแปลหัวข้อและสรุปข่าวเป็นภาษาไทย
        const translatedNews = await Promise.all(
          rawNews.map(async (item) => {
            const translatedHeadline = await translateText(item.headline);
            const translatedSummary = await translateText(item.summary);
            return {
              ...item,
              headlineTh: translatedHeadline,
              summaryTh: translatedSummary
            };
          })
        );
        setNewsList(translatedNews);
      } else {
        setNewsList([]);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setNewsList([]);
    } finally {
      setNewsLoading(false);
    }
  };

  const getChartParams = (tf, symbol) => {
    const to = Math.floor(Date.now() / 1000);
    let from, resolution;
    const day = 24 * 60 * 60;
    const isThaiStock = symbol.endsWith('.BK');
    
    switch(tf) {
      case '1D':
        from = to - day;
        resolution = isThaiStock ? 'D' : '15';
        break;
      case '3D':
        from = to - (3 * day);
        resolution = '30';
        break;
      case '1W':
        from = to - (7 * day);
        resolution = '60';
        break;
      case '1M':
        from = to - (30 * day);
        resolution = 'D';
        break;
      case '1Y':
        from = to - (365 * day);
        resolution = 'D';
        break;
      default:
        from = to - day;
        resolution = '15';
    }
    return { from, to, resolution };
  };

  const handleToggleApi = () => {
    if (!isRealtime && apiKey.trim()) {
      localStorage.setItem('finnhub_key', apiKey.trim());
      setIsRealtime(true);
      executeSearch(currentSymbol);
    } else {
      localStorage.removeItem('finnhub_key');
      setIsRealtime(false);
      setApiKey('');
      setCurrentStock(null);
      setChartData([]);
      setNewsList([]);
    }
  };

  const executeSearch = (symbolToSearch) => {
    if (!symbolToSearch.trim()) return;
    const rawSymbol = symbolToSearch.trim().toUpperCase();

    setCurrentSymbol(rawSymbol);
    setAlertTriggeredMessage('');
    
    if (alerts[rawSymbol]) {
      const config = alerts[rawSymbol];
      setAlertMode(config.mode || 'above');
      setTargetAboveInput(config.targetAbove !== undefined && config.targetAbove !== null ? config.targetAbove : '');
      setTargetBelowInput(config.targetBelow !== undefined && config.targetBelow !== null ? config.targetBelow : '');
    } else {
      setAlertMode('above');
      setTargetAboveInput('');
      setTargetBelowInput('');
    }

    if (isRealtime && apiKey) {
      fetchRealtimeData(rawSymbol);
      fetchChartData(rawSymbol, timeframe);
      fetchStockNews(rawSymbol);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchInput);
  };

  const isPinned = (sym) => pinnedSymbols.includes(sym);

  const togglePin = (sym) => {
    if (isPinned(sym)) {
      setPinnedSymbols(pinnedSymbols.filter(s => s !== sym));
    } else {
      setPinnedSymbols([...pinnedSymbols, sym]);
    }
  };

  const movePinOrder = (index, direction) => {
    const newArr = [...pinnedSymbols];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newArr.length) return;
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;
    setPinnedSymbols(newArr);
  };

  const handleSaveAlert = (e) => {
    e.preventDefault();
    if (!currentSymbol) return;

    const aboveVal = targetAboveInput !== '' ? parseFloat(targetAboveInput) : null;
    const belowVal = targetBelowInput !== '' ? parseFloat(targetBelowInput) : null;

    const updatedAlerts = {
      ...alerts,
      [currentSymbol]: {
        mode: alertMode,
        targetAbove: aboveVal,
        targetBelow: belowVal
      }
    };

    setAlerts(updatedAlerts);
    if (currentStock) {
      checkPriceAlert(currentSymbol, currentStock.price);
    }
  };

  const handleDeleteAlert = (symbol) => {
    const newAlerts = { ...alerts };
    delete newAlerts[symbol];
    setAlerts(newAlerts);
    if (symbol === currentSymbol) {
      setTargetAboveInput('');
      setTargetBelowInput('');
    }
  };

  const checkPriceAlert = (symbol, currentPrice) => {
    if (!user) return;
    const alertConfig = alerts[symbol];
    if (!alertConfig) return;

    const { mode, targetAbove, targetBelow } = alertConfig;
    let triggeredText = '';
    const priceTHB = formatNumber(currentPrice * USD_TO_THB);

    if ((mode === 'above' || mode === 'both') && targetAbove !== null && currentPrice >= targetAbove) {
      triggeredText = `🚨 แจ้งเตือน ${symbol}! ราคาสูงกว่าเป้าหมาย (≥ $${formatNumber(targetAbove)}) | ราคาปัจจุบัน: $${formatNumber(currentPrice)} (${priceTHB} ฿)`;
    } else if ((mode === 'below' || mode === 'both') && targetBelow !== null && currentPrice <= targetBelow) {
      triggeredText = `🚨 แจ้งเตือน ${symbol}! ราคาต่ำกว่าเป้าหมาย (≤ $${formatNumber(targetBelow)}) | ราคาปัจจุบัน: $${formatNumber(currentPrice)} (${priceTHB} ฿)`;
    }

    if (triggeredText) {
      setAlertTriggeredMessage(triggeredText);
    }
  };

  useEffect(() => {
    if (currentSymbol && isRealtime && apiKey) {
      fetchChartData(currentSymbol, timeframe);
    }
  }, [timeframe]);

  useEffect(() => {
    if (!currentSymbol || !isRealtime || !apiKey) return;

    fetchRealtimeData(currentSymbol, false);
    fetchStockNews(currentSymbol);

    const interval = setInterval(() => {
      fetchRealtimeData(currentSymbol, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [currentSymbol, isRealtime, apiKey]);

  const fetchRealtimeData = async (symbol, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
      const data = await response.json();
      
      if (data && data.c !== undefined && data.c !== 0) { 
        const price = data.c;
        setCurrentStock({
          symbol: symbol,
          price: price,
          change: data.d,
          percentChange: data.dp,
          open: data.o,
          high: data.h,
          low: data.l,
          previousClose: data.pc
        });

        checkPriceAlert(symbol, price);
      } else {
        if (!silent) setError(`ไม่พบข้อมูลของหุ้น "${symbol}" หรือ API Key อาจไม่ถูกต้อง / ตลาดปิด`);
      }
    } catch (err) {
      if (!silent) setError('เกิดข้อผิดพลาดในการเชื่อมต่อ API');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchChartData = async (symbol, tf) => {
    setChartLoading(true);
    try {
      const { from, to, resolution } = getChartParams(tf, symbol);
      const response = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`);
      const data = await response.json();

      if (data.s === 'ok' && data.t) {
        const formattedData = data.t.map((timestamp, index) => {
          const date = new Date(timestamp * 1000);
          const timeString = (tf === '1D' || tf === '3D' || tf === '1W') 
            ? date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            
          return {
            time: timeString,
            price: data.c[index]
          };
        });
        setChartData(formattedData);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('Chart error:', err);
    } finally {
      setChartLoading(false);
    }
  };

  const isPositive = currentStock ? currentStock.change >= 0 : true;
  const priceInTHB = currentStock ? formatNumber(currentStock.price * USD_TO_THB) : '0.00';

  const StockLogo = ({ symbol, size = "w-8 h-8" }) => {
    const [imgError, setImgError] = useState(false);
    const cleanSym = symbol.replace('.BK', '');
    const firstLetter = cleanSym.charAt(0);
    const colors = ['bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-amber-600', 'bg-rose-600', 'bg-indigo-600'];
    const colorClass = colors[cleanSym.length % colors.length];

    if (imgError) {
      return (
        <div className={`${size} rounded-lg ${colorClass} flex items-center justify-center font-bold text-white text-xs shadow shrink-0`}>
          {firstLetter}
        </div>
      );
    }

    return (
      <div className={`${size} rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center overflow-hidden shadow shrink-0`}>
        <img 
          src={getStockLogoUrl(symbol)} 
          alt={symbol}
          className="w-full h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header พร้อมระบบ Hamburger Menu ด้านขวา */}
        <div className="relative flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700 z-50">
          <div className="flex items-center gap-2 text-xl font-bold text-emerald-400">
            <Activity className="w-6 h-6" />
            <span>StockMonitor Pro + Cloud Sync</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* สถานะบัญชีผู้ใช้ */}
            {user ? (
              <span className="text-xs md:text-sm bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
                👤 <b className="text-emerald-400">{user.email}</b>
              </span>
            ) : (
              <form onSubmit={handleAuthSubmit} className="hidden md:flex items-center gap-2">
                {authError && <span className="text-xs text-red-400">{authError}</span>}
                <input 
                  type="email" 
                  placeholder="อีเมล" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                />
                <input 
                  type="password" 
                  placeholder="รหัสผ่าน" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                >
                  {isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
                </button>
              </form>
            )}

            {/* ปุ่มขีดสามขีด (Hamburger Menu) */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition-colors relative"
              title="เมนูตั้งค่า"
            >
              {isMenuOpen ? <X className="w-6 h-6 text-red-400" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Dropdown Menu เมื่อกดปุ่มขีดสามขีด */}
          {isMenuOpen && (
            <div className="absolute right-0 top-16 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 space-y-4 text-sm z-50">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Settings className="w-4 h-4" /> เมนูและการตั้งค่า
                </span>
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!user && (
                <div className="block md:hidden border-b border-gray-700 pb-3">
                  <form onSubmit={handleAuthSubmit} className="space-y-2">
                    <p className="text-xs text-gray-400 font-semibold">เข้าสู่ระบบ / สมัครสมาชิก</p>
                    <input 
                      type="email" 
                      placeholder="อีเมล" 
                      value={authEmail} 
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                    <input 
                      type="password" 
                      placeholder="รหัสผ่าน" 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                    <button type="submit" className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium">
                      {isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
                    </button>
                  </form>
                </div>
              )}

              {/* ส่วนจัดการ API Key */}
              <div className="space-y-2 border-b border-gray-700 pb-3">
                <label className="block text-xs text-gray-400 font-semibold">Finnhub API Key</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="ใส่ API Key ของคุณ" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isRealtime}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                  <button 
                    onClick={handleToggleApi}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                      isRealtime ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isRealtime ? 'ตัดการเชื่อมต่อ' : 'บันทึก'}
                  </button>
                </div>
              </div>

              {/* ปุ่มออกจากระบบ */}
              {user && (
                <button 
                  onClick={() => {
                    signOut(auth);
                    setIsMenuOpen(false);
                  }}
                  className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/50 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ออกจากระบบ</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Layout หลัก: แบ่งออกเป็น 3 คอลัมน์ (ซ้าย, กลาง, ขวา) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* คอลัมน์ซ้าย (3/12): หุ้นปักหมุด (1), หุ้นแนะนำ (2) และข่าวสารหุ้น (4) */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* กรอบที่ 1: หุ้นที่ปักหมุด (พร้อมแถบเลื่อน Scrollbar เมื่อเกิน 4 รายการ) */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Pin className="w-4 h-4 fill-amber-400" /> หุ้นที่ปักหมุด ({pinnedSymbols.length})
                </h3>
              </div>

              {pinnedSymbols.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">ยังไม่มีหุ้นปักหมุด</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                  {pinnedSymbols.map((sym, idx) => {
                    const info = watchlistData[sym];
                    const changeVal = info ? info.change : 0;
                    const isUp = changeVal >= 0;
                    const isSelected = currentSymbol === sym;

                    return (
                      <div 
                        key={sym}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected ? 'bg-emerald-950/60 border-emerald-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => executeSearch(sym)}
                      >
                        <div className="flex items-center gap-2.5">
                          <StockLogo symbol={sym} size="w-8 h-8" />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight">{sym}</span>
                            <span className="text-xs text-gray-400">
                              {info ? `$${formatNumber(info.price)}` : 'Loading...'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {info && (
                            <span className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isUp ? '+' : ''}{formatNumber(info.percentChange)}%
                            </span>
                          )}

                          <div className="flex flex-col ml-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => movePinOrder(idx, 'up')}
                              disabled={idx === 0}
                              className="text-gray-500 hover:text-white disabled:opacity-30"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => movePinOrder(idx, 'down')}
                              disabled={idx === pinnedSymbols.length - 1}
                              className="text-gray-500 hover:text-white disabled:opacity-30"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button 
                            onClick={(e) => { e.stopPropagation(); togglePin(sym); }}
                            className="text-amber-400 hover:text-red-400 ml-1 p-1"
                            title="ยกเลิกปักหมุด"
                          >
                            <Pin className="w-3.5 h-3.5 fill-amber-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* กรอบที่ 2: หุ้นแนะนำตลาด (พร้อมแถบเลื่อน Scrollbar เมื่อเกิน 5 รายการ) */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> หุ้นแนะนำตลาด
                </h3>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {suggestedStocks.map((sym) => {
                  const info = watchlistData[sym];
                  const pinned = isPinned(sym);
                  const isSelected = currentSymbol === sym;

                  return (
                    <div 
                      key={sym}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected ? 'bg-emerald-950/60 border-emerald-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => executeSearch(sym)}
                    >
                      <div className="flex items-center gap-2.5">
                        <StockLogo symbol={sym} size="w-8 h-8" />
                        <div className="flex flex-col">
                          <span className="font-bold text-sm leading-tight">{sym}</span>
                          <span className="text-xs text-gray-400">
                            {info ? `$${formatNumber(info.price)}` : 'Loading...'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {info && (
                          <span className={`text-xs font-semibold ${info.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {info.change >= 0 ? '+' : ''}{formatNumber(info.percentChange)}%
                          </span>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); togglePin(sym); }}
                          className={`p-1.5 rounded transition-colors ${pinned ? 'text-amber-400 bg-amber-950/50' : 'text-gray-500 hover:text-amber-400 bg-gray-800'}`}
                        >
                          <Pin className={`w-3.5 h-3.5 ${pinned ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* กรอบที่ 4: ข่าวสารหุ้นตัวที่เลือกพร้อมแปลภาษาไทย */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-1.5">
                  <Newspaper className="w-4 h-4" />
                  ข่าวสารหุ้น ({currentSymbol})
                </h3>
                <button 
                  onClick={() => fetchStockNews(currentSymbol)}
                  className="text-gray-400 hover:text-white p-1"
                  title="รีเฟรชข่าว"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${newsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {newsLoading ? (
                <p className="text-xs text-gray-400 text-center py-6">กำลังโหลดข่าวสารและแปลภาษาไทย...</p>
              ) : newsList.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">ไม่มีข่าวสารล่าสุดของ {currentSymbol}</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {newsList.map((news) => (
                    <div key={news.id} className="bg-gray-900/80 p-3 rounded-lg border border-gray-700 space-y-1.5 hover:border-gray-600 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <a 
                          href={news.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-semibold text-xs text-gray-200 hover:text-blue-400 leading-snug line-clamp-2"
                        >
                          {news.headlineTh || news.headline}
                        </a>
                        <a 
                          href={news.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {news.summaryTh && (
                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                          {news.summaryTh}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                        <span>ที่มา: {news.source}</span>
                        <span>{new Date(news.datetime * 1000).toLocaleDateString('th-TH')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* คอลัมน์กลาง (6/12): ค้นหา, รายละเอียดหุ้น + ฟอร์มแจ้งเตือน และกราฟ */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* ช่องค้นหาหุ้น */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="พิมพ์ชื่อหุ้นที่ต้องการค้นหา (เช่น NVDA, AAPL)..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pl-12 text-base focus:outline-none focus:border-emerald-500 shadow-lg uppercase"
                  />
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Search className="w-5 h-5" />
                  <span>ค้นหา</span>
                </button>
              </form>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {alertTriggeredMessage && (
              <div className="flex items-center justify-between bg-amber-500 border border-amber-400 text-gray-900 px-4 py-3 rounded-xl shadow-lg animate-pulse">
                <div className="flex items-center gap-2 font-bold text-base">
                  <Bell className="w-6 h-6 animate-bounce shrink-0" />
                  <span>{alertTriggeredMessage}</span>
                </div>
                <button 
                  onClick={() => setAlertTriggeredMessage('')}
                  className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-800 shrink-0 ml-4"
                >
                  รับทราบ
                </button>
              </div>
            )}

            {!loading && currentStock && (
              <div className="space-y-6">
                
                {/* กล่องแสดงราคาหุ้น พร้อมตั้งค่าการแจ้งเตือนในตัว */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* ข้อมูลราคาหุ้นฝั่งซ้าย */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <StockLogo symbol={currentStock.symbol} size="w-12 h-12" />
                        <div>
                          <h2 className="text-3xl font-bold flex items-center gap-2">
                            <span>{currentStock.symbol}</span>
                          </h2>
                          <button 
                            onClick={() => togglePin(currentSymbol)}
                            className={`mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                              isPinned(currentSymbol) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            <Pin className={`w-3 h-3 ${isPinned(currentSymbol) ? 'fill-amber-400' : ''}`} />
                            <span>{isPinned(currentSymbol) ? 'ปักหมุดแล้ว' : 'ปักหมุดหุ้นนี้'}</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-baseline flex-wrap gap-2">
                          <span className="text-4xl font-bold tracking-tight">
                            ${formatNumber(currentStock.price)}
                          </span>
                        </div>
                        <span className="text-lg text-gray-400 font-medium">
                          = {priceInTHB} ฿
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-2 text-lg ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        <span className="font-semibold">
                          {isPositive ? '+' : ''}{formatNumber(currentStock.change)} ({isPositive ? '+' : ''}{formatNumber(currentStock.percentChange)}%)
                        </span>
                      </div>

                      <div className="pt-2 text-gray-500 text-xs flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>อัปเดตล่าสุด: {new Date().toLocaleTimeString('th-TH')}</span>
                      </div>
                    </div>

                    {/* การ์ดตั้งค่าการแจ้งเตือนราคา */}
                    <div className="bg-gray-900/90 border border-gray-700 rounded-xl p-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                            <Bell className="w-4 h-4" /> ตั้งค่าแจ้งเตือนราคา ({currentSymbol})
                          </h3>
                        </div>

                        {!user ? (
                          <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                            <Lock className="w-8 h-8 text-amber-400/80" />
                            <p className="text-xs text-gray-300">กรุณาเข้าสู่ระบบเพื่อใช้งานแจ้งเตือนราคา</p>
                          </div>
                        ) : (
                          <form onSubmit={handleSaveAlert} className="space-y-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">เงื่อนไข</label>
                              <select 
                                value={alertMode} 
                                onChange={(e) => setAlertMode(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                              >
                                <option value="above">ราคาสูงกว่าเป้าหมาย (≥)</option>
                                <option value="below">ราคาต่ำกว่าเป้าหมาย (≤)</option>
                                <option value="both">ทั้งสองเงื่อนไข</option>
                              </select>
                            </div>

                            {(alertMode === 'above' || alertMode === 'both') && (
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">แจ้งเตือนเมื่อสูงกว่า ($)</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  placeholder={`เช่น ${formatNumber(currentStock.price * 1.05)}`}
                                  value={targetAboveInput}
                                  onChange={(e) => setTargetAboveInput(e.target.value)}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            )}

                            {(alertMode === 'below' || alertMode === 'both') && (
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">แจ้งเตือนเมื่อต่ำกว่า ($)</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  placeholder={`เช่น ${formatNumber(currentStock.price * 0.95)}`}
                                  value={targetBelowInput}
                                  onChange={(e) => setTargetBelowInput(e.target.value)}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <button 
                                type="submit"
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                              >
                                <Bell className="w-3.5 h-3.5" />
                                <span>บันทึก</span>
                              </button>

                              {alerts[currentSymbol] && (
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteAlert(currentSymbol)}
                                  className="bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700 p-1.5 rounded-lg text-xs"
                                  title="ลบการแจ้งเตือน"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* กราฟ */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-emerald-500" />
                      กราฟราคาจริง ({currentSymbol})
                    </h3>
                    
                    <div className="flex bg-gray-900 rounded-lg p-1">
                      {['1D', '3D', '1W', '1M', '1Y'].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            timeframe === tf 
                              ? 'bg-emerald-600 text-white' 
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="h-64 w-full flex-grow relative">
                    {chartLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
                        กำลังโหลดข้อมูลกราฟ...
                      </div>
                    ) : chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                          <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                          <YAxis domain={['auto', 'auto']} stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${formatNumber(val)}`} width={75} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#F3F4F6' }}
                            itemStyle={{ color: '#34D399' }}
                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                            formatter={(val) => [`$${formatNumber(val)} (${formatNumber(val * USD_TO_THB)} ฿)`, 'ราคา']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke={isPositive ? "#34D399" : "#F87171"} 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 6, fill: isPositive ? "#34D399" : "#F87171", stroke: '#111827', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center px-4">
                        ไม่มีข้อมูลในช่วงเวลานี้ (ตลาดอาจปิด หรือโปรดตรวจสอบ API Key)
                      </div>
                    )}
                  </div>
                </div>

                {/* สถิติย่อย */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'ราคาเปิด (Open)', value: `$${formatNumber(currentStock.open)}` },
                    { label: 'ราคาสูงสุด (High)', value: `$${formatNumber(currentStock.high)}` },
                    { label: 'ราคาต่ำสุด (Low)', value: `$${formatNumber(currentStock.low)}` },
                    { label: 'ปิดวันก่อนหน้า (Prev Close)', value: `$${formatNumber(currentStock.previousClose)}` }
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                      <p className="text-gray-400 text-sm">{stat.label}</p>
                      <p className="text-xl font-semibold mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>

          {/* คอลัมน์ขวา (3/12): กรอบที่ 3 แสดงข้อมูลรายการแจ้งเตือนทั้งหมด (พร้อมแถบเลื่อน Scrollbar) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3 h-full flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-amber-400" />
                  รายการแจ้งเตือนทั้งหมด ({Object.keys(alerts).length})
                </h3>
              </div>

              {Object.keys(alerts).length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500 text-xs">
                  <Bell className="w-8 h-8 opacity-30 mb-2" />
                  <span>ยังไม่มีการตั้งค่าแจ้งเตือนราคาหุ้น</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1 custom-scrollbar">
                  {Object.entries(alerts).map(([symbol, config]) => {
                    const info = watchlistData[symbol];
                    const isCurrent = currentSymbol === symbol;

                    return (
                      <div 
                        key={symbol}
                        onClick={() => executeSearch(symbol)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                          isCurrent ? 'bg-amber-950/30 border-amber-500/80' : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StockLogo symbol={symbol} size="w-6 h-6" />
                            <span className="font-bold text-sm">{symbol}</span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAlert(symbol);
                            }}
                            className="text-gray-500 hover:text-red-400 p-1"
                            title="ลบแจ้งเตือน"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-xs space-y-1 bg-gray-800/80 p-2 rounded border border-gray-700/50">
                          {info && (
                            <div className="flex justify-between text-gray-400 border-b border-gray-700/50 pb-1 mb-1">
                              <span>ราคาปัจจุบัน:</span>
                              <span className="text-white font-medium">${formatNumber(info.price)}</span>
                            </div>
                          )}
                          
                          {config.targetAbove !== null && config.targetAbove !== undefined && (
                            <div className="flex justify-between text-emerald-400">
                              <span>ราคาสูงกว่า (≥):</span>
                              <span className="font-semibold">${formatNumber(config.targetAbove)}</span>
                            </div>
                          )}

                          {config.targetBelow !== null && config.targetBelow !== undefined && (
                            <div className="flex justify-between text-red-400">
                              <span>ราคาต่ำกว่า (≤):</span>
                              <span className="font-semibold">${formatNumber(config.targetBelow)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}