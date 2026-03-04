import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Tent,
  Utensils,
  CheckCircle2,
  Circle,
  User,
  Plus,
  Minus,
  Trash2,
  Users,
  Backpack,
  X,
  Coffee,
  Sun,
  Moon,
  Utensils as DinnerIcon,
  Sunrise,
  Check,
  ClipboardList,
  UserCircle2,
  Wallet,
  Receipt,
  LayoutGrid,
  List as ListIcon,
  FileSpreadsheet,
  RefreshCw,
  Download,
  Upload,
  KeyRound,
  Filter
} from 'lucide-react';

// --- Firebase 引用 ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { calculateDebts, computeSettlement, INITIAL_CATEGORIES } from './logic';

// --- Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyARalLtrATMt7Bx9DtWMRQMDeYeA5sXrJg",
  authDomain: "campsync-19e0a.firebaseapp.com",
  projectId: "campsync-19e0a",
  storageBucket: "campsync-19e0a.firebasestorage.app",
  messagingSenderId: "901875840803",
  appId: "1:901875840803:web:dffbd949a78e634d63fe96"
};
const appId = 'campsync';

// 初始化 Firebase
let db, auth;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  if (import.meta.env.DEV) console.error("Firebase 初始化錯誤:", e);
}

// --- 密碼 Hash 工具 ---
const hashPassword = async (pw) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- 常數設定 ---
const MEAL_TYPES = [
  { id: 'breakfast', label: '早餐', icon: <Sunrise className="w-4 h-4" /> },
  { id: 'lunch', label: '午餐', icon: <Sun className="w-4 h-4" /> },
  { id: 'afternoonTea', label: '下午茶', icon: <Coffee className="w-4 h-4" /> },
  { id: 'dinner', label: '晚餐', icon: <DinnerIcon className="w-4 h-4" /> },
  { id: 'lateNight', label: '宵夜', icon: <Moon className="w-4 h-4" /> }
];

const INITIAL_USERS = ['傑克', '愛麗絲', '湯姆'];

const INITIAL_ITEMS = [
  { id: 1, type: 'gear', name: '6人帳篷', category: '睡眠裝備', quantity: 1, assignedTo: '傑克', packed: false, cost: 0, splitMembers: null },
  { id: 2, type: 'gear', name: '卡式爐', category: '廚房炊具', quantity: 2, assignedTo: null, packed: false, cost: 0, splitMembers: null },
  { id: 3, type: 'gear', name: '瓦斯罐', category: '廚房炊具', quantity: 6, assignedTo: '傑克', packed: false, cost: 150, splitMembers: null },
  { id: 4, type: 'food', name: '牛肉麵食材', dayIndex: 0, mealId: 'dinner', assignedTo: '愛麗絲', packed: false, cost: 500, splitMembers: ['愛麗絲', '湯姆'] },
];

// --- 基礎元件 ---
const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''} ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, loading = false }) => {
  const baseStyle = "px-4 py-2 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  const variants = {
    primary: "bg-stone-800 text-white hover:bg-stone-700 shadow-md shadow-stone-200",
    secondary: "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 shadow-sm",
    ghost: "bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-700",
    danger: "bg-red-50 text-red-500 hover:bg-red-100",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 shadow-md",
    teal: "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-200 shadow-md",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-md",
    amber: "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200 shadow-md",
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled || loading}>
      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : children}
    </button>
  );
};

// --- 主應用程式元件 ---
export default function App() {
  // --- Refs ---
  const expNameRef = useRef(null);
  const expCostRef = useRef(null);
  const expPayerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isLocalUpdate = useRef(false); // Firebase onSnapshot 迴圈保護
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState('list');
  const [listMode, setListMode] = useState('gear');

  // 模板狀態
  const [savedTemplates, setSavedTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('camp_gear_templates') || '[]'); } catch { return []; }
  });
  const [templateName, setTemplateName] = useState('');

  // 資料狀態
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [daysCount, setDaysCount] = useState(2);
  const [activeMeals, setActiveMeals] = useState(MEAL_TYPES.map(m => m.id));
  const [mealDishNames, setMealDishNames] = useState({});
  const [hiddenMeals, setHiddenMeals] = useState({}); // { dayIndex: [mealId, ...] }
  const [currentUser, setCurrentUser] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unpacked' | 'unassigned'

  // 認證狀態
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [isRoomAuthenticated, setIsRoomAuthenticated] = useState(false);

  // UI 輸入
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemCategory, setNewItemCategory] = useState(INITIAL_CATEGORIES[0]);
  const [newFoodInputs, setNewFoodInputs] = useState({});

  // 同步狀態
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // --- 副作用處理 ---
  useEffect(() => {
    const savedUser = localStorage.getItem('camp_current_user');
    const savedRoomId = localStorage.getItem('camp_room_id');
    const savedRoomPw = localStorage.getItem('camp_room_password');

    if (savedUser) setCurrentUser(savedUser);
    if (savedRoomId && savedRoomPw) {
      setRoomId(savedRoomId);
      setRoomPassword(savedRoomPw); // savedRoomPw 已是 hash
      setIsRoomAuthenticated(true); // 樂觀驗證
    }

    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error("Auth 初始化錯誤:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => setFirebaseUser(user));
    return () => unsubscribe();
  }, []);

  // Firebase 即時同步
  useEffect(() => {
    if (!isRoomAuthenticated || !firebaseUser || !roomId || !db) return;

    const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'camp_rooms', roomId);

    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
      // 跳過自己寫入觸發的回撥，避免迴圈覆蓋
      if (isLocalUpdate.current) {
        isLocalUpdate.current = false;
        return;
      }
      if (docSnap.exists()) {
        const data = docSnap.data();
        setItems(data.items || []);
        const remoteUsers = data.users || [];
        if (currentUser && !remoteUsers.includes(currentUser)) {
          saveToCloud(data.items || [], [...remoteUsers, currentUser], data.daysCount || 2);
        } else {
          setUsers(remoteUsers);
        }
        setDaysCount(data.daysCount || 2);
        if (data.activeMeals) setActiveMeals(data.activeMeals);
        if (data.mealDishNames) setMealDishNames(data.mealDishNames);
        if (data.hiddenMeals) setHiddenMeals(data.hiddenMeals);
      }
    }, (error) => {
      if (import.meta.env.DEV) console.error("Firebase 同步錯誤:", error);
    });
    return () => unsubscribe();
  }, [isRoomAuthenticated, firebaseUser, roomId, currentUser]);

  // --- 資料存取輔助 ---
  const saveData = (newItems, newUsers, newDaysCount, extraState = {}) => {
    setItems(newItems);
    setUsers(newUsers);
    setDaysCount(newDaysCount);
    if (extraState.activeMeals !== undefined) setActiveMeals(extraState.activeMeals);
    if (extraState.mealDishNames !== undefined) setMealDishNames(extraState.mealDishNames);
    if (extraState.hiddenMeals !== undefined) setHiddenMeals(extraState.hiddenMeals);

    const payload = {
      items: newItems, users: newUsers, daysCount: newDaysCount,
      activeMeals: extraState.activeMeals ?? activeMeals,
      mealDishNames: extraState.mealDishNames ?? mealDishNames,
      hiddenMeals: extraState.hiddenMeals ?? hiddenMeals,
      lastUpdated: new Date().toISOString()
    };

    if (db && roomId && firebaseUser) {
      saveToCloud(newItems, newUsers, newDaysCount, extraState);
    } else {
      localStorage.setItem('campSyncData_v3', JSON.stringify(payload));
    }
  };

  const saveToCloud = async (i, u, d, extraState = {}) => {
    if (!db || !roomId || !firebaseUser) return;
    try {
      isLocalUpdate.current = true; // 標記本地寫入，防止 onSnapshot 回撥覆蓋
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'camp_rooms', roomId);
      await setDoc(roomDocRef, {
        items: i, users: u, daysCount: d, lastUpdated: new Date().toISOString(),
        activeMeals: extraState.activeMeals ?? activeMeals,
        mealDishNames: extraState.mealDishNames ?? mealDishNames,
        hiddenMeals: extraState.hiddenMeals ?? hiddenMeals
      }, { merge: true });
    } catch (e) {
      isLocalUpdate.current = false;
      if (import.meta.env.DEV) console.error("雲端存檔錯誤:", e);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- 處理函式 ---
  const handleRoomAuth = async (e) => {
    e.preventDefault();
    const currentRoomId = roomId.trim();
    if (!currentRoomId || !roomPassword.trim()) {
      showNotification("請輸入完整房間資訊", "error");
      return;
    }

    if (!db) {
      showNotification("系統尚未準備完成，請稍後再試", "error");
      return;
    }

    setIsAuthenticating(true);
    const pwHash = roomPassword.length === 64 ? roomPassword : await hashPassword(roomPassword);

    try {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'camp_rooms', currentRoomId);
      const docSnap = await getDoc(roomDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pw !== pwHash) {
          showNotification("密碼錯誤，無法登入", "error");
          setIsRoomAuthenticated(false);
          localStorage.removeItem('camp_room_id');
          localStorage.removeItem('camp_room_password');
          setIsAuthenticating(false);
          return;
        }

        // 登入成功
        setIsRoomAuthenticated(true);
        setItems(data.items || []);
        setUsers(data.users || []);
        setDaysCount(data.daysCount || 2);
        if (data.activeMeals) setActiveMeals(data.activeMeals);
        if (data.mealDishNames) setMealDishNames(data.mealDishNames);
        if (data.hiddenMeals) setHiddenMeals(data.hiddenMeals);
        showNotification(`成功進入房間：${currentRoomId}`);
      } else {
        // 房間不存在，直接創建
        setIsRoomAuthenticated(true);
        showNotification("新房間創建成功！", "success");
        await setDoc(roomDocRef, {
          pw: pwHash,
          items: INITIAL_ITEMS,
          users: INITIAL_USERS,
          daysCount: 2,
          lastUpdated: new Date().toISOString()
        });
        setItems(INITIAL_ITEMS);
        setUsers(INITIAL_USERS);
        setDaysCount(2);
      }

      localStorage.setItem('camp_room_id', currentRoomId);
      localStorage.setItem('camp_room_password', pwHash);
    } catch (error) {
      if (import.meta.env.DEV) console.error("房間驗證錯誤:", error);
      showNotification("連線失敗，請檢查網路或權限", "error");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = (name) => {
    if (!name.trim()) return;
    const userName = name.trim();
    setCurrentUser(userName);
    localStorage.setItem('camp_current_user', userName);
    if (!users.includes(userName)) {
      saveData(items, [...users, userName], daysCount);
    }
  };

  const addGearItem = () => {
    if (!newItemName.trim()) return;
    const qty = parseInt(newItemQuantity) || 1;
    const newItem = { id: Date.now(), type: 'gear', name: newItemName, category: newItemCategory, quantity: qty, assignedTo: currentUser, packed: false, cost: 0, splitMembers: null };
    saveData([...items, newItem], users, daysCount);
    setNewItemName('');
    setNewItemQuantity(1);
    showNotification(`已新增裝備`);
  };

  const addFoodItem = (dayIndex, mealId) => {
    const key = `${dayIndex}-${mealId}`;
    const name = newFoodInputs[key];
    if (!name || !name.trim()) return;
    const newItem = { id: Date.now(), type: 'food', name: name, dayIndex, mealId, assignedTo: currentUser, packed: false, cost: 0, splitMembers: null };
    saveData([...items, newItem], users, daysCount);
    setNewFoodInputs({ ...newFoodInputs, [key]: '' });
    showNotification(`已新增食材`);
  };

  // --- 天數增減 ---
  const addDay = () => saveData(items, users, daysCount + 1);
  const removeDay = () => {
    if (daysCount <= 1) return;
    const lastDayIndex = daysCount - 1;
    const hasItems = items.some(i => i.type === 'food' && i.dayIndex === lastDayIndex);
    if (hasItems && !window.confirm(`Day ${daysCount} 尚有食材項目，確定刪除？`)) return;
    const cleaned = items.filter(i => !(i.type === 'food' && i.dayIndex === lastDayIndex));
    saveData(cleaned, users, daysCount - 1);
  };

  // --- 隱藏餐別（不刪 items）---
  const removeMeal = (mealId, dayIndex) => {
    const dayHidden = hiddenMeals[dayIndex] || [];
    if (dayHidden.includes(mealId)) return;
    const newHidden = { ...hiddenMeals, [dayIndex]: [...dayHidden, mealId] };
    saveData(items, users, daysCount, { hiddenMeals: newHidden });
  };

  // --- 加回隱藏餐別 ---
  const restoreMeal = (mealId, dayIndex) => {
    const dayHidden = (hiddenMeals[dayIndex] || []).filter(id => id !== mealId);
    const newHidden = { ...hiddenMeals };
    if (dayHidden.length === 0) delete newHidden[dayIndex];
    else newHidden[dayIndex] = dayHidden;
    saveData(items, users, daysCount, { hiddenMeals: newHidden });
  };

  // --- 餐別菜色命名 ---
  const setDishName = (dayIndex, mealId, name) => {
    const key = `${dayIndex}-${mealId}`;
    const newNames = { ...mealDishNames, [key]: name };
    if (!name) delete newNames[key];
    setMealDishNames(newNames);
    // debounce sync — 利用 saveData 機制
    saveData(items, users, daysCount, { mealDishNames: newNames });
  };

  const addExpenseItem = (name, cost, payer) => {
    const finalPayer = payer || currentUser;
    const newItem = { id: Date.now(), type: 'gear', name: name, category: '其他', quantity: 1, assignedTo: finalPayer, packed: true, cost: parseInt(cost) || 0, splitMembers: null };
    saveData([...items, newItem], users, daysCount);
    showNotification('已新增費用');
  };

  const deleteItem = (id) => saveData(items.filter(item => item.id !== id), users, daysCount);

  // --- 模板函式 ---
  const exportTemplate = () => {
    if (!templateName.trim()) { showNotification('請輸入模板名稱', 'error'); return; }
    const gearItems = items.filter(i => i.type === 'gear').map(({ name, category, quantity }) => ({ name, category, quantity }));
    if (gearItems.length === 0) { showNotification('目前沒有裝備可匯出', 'error'); return; }
    const newTemplates = [...savedTemplates, { name: templateName.trim(), items: gearItems, createdAt: new Date().toISOString() }];
    setSavedTemplates(newTemplates);
    localStorage.setItem('camp_gear_templates', JSON.stringify(newTemplates));
    setTemplateName('');
    showNotification(`模板「${templateName.trim()}」已儲存（${gearItems.length} 項）`);
  };
  const importTemplate = (template) => {
    if (!window.confirm(`載入「${template.name}」？將覆蓋目前所有裝備項目`)) return;
    const foodItems = items.filter(i => i.type === 'food');
    const newGear = template.items.map((t, idx) => ({
      id: Date.now() + idx, type: 'gear', name: t.name, category: t.category,
      quantity: t.quantity, assignedTo: null, packed: false, cost: 0, splitMembers: null
    }));
    saveData([...foodItems, ...newGear], users, daysCount);
    showNotification(`已載入「${template.name}」（${newGear.length} 項裝備）`);
  };
  const deleteTemplate = (idx) => {
    const newTemplates = savedTemplates.filter((_, i) => i !== idx);
    setSavedTemplates(newTemplates);
    localStorage.setItem('camp_gear_templates', JSON.stringify(newTemplates));
    showNotification('模板已刪除');
  };
  const downloadTemplateAsFile = (template) => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name || 'campsync_gear'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`已下載「${template.name}」`);
  };
  const downloadCurrentAsFile = () => {
    const gearItems = items.filter(i => i.type === 'gear').map(({ name, category, quantity }) => ({ name, category, quantity }));
    if (gearItems.length === 0) { showNotification('目前沒有裝備可匯出', 'error'); return; }
    const template = { name: templateName.trim() || `CampSync_${roomId}`, items: gearItems, createdAt: new Date().toISOString() };
    downloadTemplateAsFile(template);
  };
  const uploadTemplateFromFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // V-09 fix: 檔案大小限制 100KB
    if (file.size > 102400) { showNotification('檔案超過 100KB 限制', 'error'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.items || !Array.isArray(data.items)) { showNotification('無效的模板格式', 'error'); return; }
        const template = { name: data.name || file.name.replace('.json', ''), items: data.items, createdAt: data.createdAt || new Date().toISOString() };
        importTemplate(template);
      } catch { showNotification('JSON 解析失敗', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };
  const moveItemToMeal = (itemId, newDayIndex, newMealId) => {
    saveData(items.map(i => i.id === itemId ? { ...i, dayIndex: newDayIndex, mealId: newMealId } : i), users, daysCount);
    showNotification('已移動食材');
  };

  const togglePacked = (id) => saveData(items.map(i => i.id === id ? { ...i, packed: !i.packed } : i), users, daysCount);
  const updateAssignment = (id, user) => saveData(items.map(i => i.id === id ? { ...i, assignedTo: user === "unassigned" ? null : user } : i), users, daysCount);
  const updateCost = (id, cost) => saveData(items.map(i => i.id === id ? { ...i, cost: Math.max(0, parseInt(cost) || 0) } : i), users, daysCount);
  const updateQuantity = (id, newQty) => saveData(items.map(i => i.id === id ? { ...i, quantity: Math.max(1, parseInt(newQty) || 1) } : i), users, daysCount);
  const updateSplitMembers = (id, members) => saveData(items.map(i => i.id === id ? { ...i, splitMembers: (members && members.length === users.length) ? null : members } : i), users, daysCount);
  const addUser = (name) => { if (name && !users.includes(name)) { saveData(items, [...users, name], daysCount); showNotification(`歡迎 ${name}！`); } };
  const removeUser = (name) => {
    const newUsers = users.filter(u => u !== name);
    const newItems = items.map(i => {
      let updates = {};
      if (i.assignedTo === name) updates.assignedTo = null;
      if (i.splitMembers && i.splitMembers.includes(name)) updates.splitMembers = i.splitMembers.filter(m => m !== name);
      return { ...i, ...updates };
    });
    saveData(newItems, newUsers, daysCount);
  };

  const settlementData = useMemo(() => {
    return computeSettlement(items, users, hiddenMeals);
  }, [items, users, hiddenMeals]);

  const groupedGear = useMemo(() => {
    return INITIAL_CATEGORIES.map(cat => ({
      category: cat,
      items: items.filter(i => {
        const isGear = (i.type === 'gear' || !i.type);
        const isInCat = i.category === cat;
        const filterMatch = filterMode === 'unpacked' ? !i.packed : filterMode === 'unassigned' ? !i.assignedTo : true;
        return isGear && isInCat && filterMatch;
      })
    })).filter(g => g.items.length > 0);
  }, [items, filterMode]);

  // --- 畫面渲染 ---

  // 房間登入畫面
  if (!isRoomAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
        {notification && (
          <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl text-white font-medium ${notification.type === 'error' ? 'bg-red-500' : 'bg-stone-800'}`}>
            {notification.msg}
          </div>
        )}
        <Card className="w-full max-w-md p-8 space-y-8 shadow-xl">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-50">
              <Tent className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-stone-800">CampSync</h1>
            <p className="text-stone-500 mt-2">請輸入房間 ID 與密碼以進行同步</p>
          </div>
          <form onSubmit={handleRoomAuth} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="房間 ID (例如: CAMP2024)"
                className="w-full p-4 pl-12 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              />
              <Tent className="absolute left-4 top-4 text-stone-300" size={20} />
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="房間密碼"
                className="w-full p-4 pl-12 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
              />
              <KeyRound className="absolute left-4 top-4 text-stone-300" size={20} />
            </div>
            <Button variant="emerald" className="w-full py-4 text-lg" loading={isAuthenticating} disabled={isAuthenticating}>
              進入房間 / 創建房間
            </Button>
          </form>
          <div className="text-[10px] text-stone-400 uppercase tracking-widest">
            如果 Room ID 不存在，將會自動為您創建新房間
          </div>
        </Card>
      </div>
    );
  }

  // 用戶登入畫面
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} notification={notification} />;
  }

  const FilterSwitch = () => (
    <div className="flex items-center justify-between px-2 py-2 bg-stone-50 rounded-xl">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterMode('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterMode === 'all' ? 'bg-stone-800 text-white shadow-sm' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          全部
        </button>
        <button
          onClick={() => setFilterMode('unpacked')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterMode === 'unpacked' ? 'bg-amber-500 text-white shadow-sm' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          未準備
        </button>
        <button
          onClick={() => setFilterMode('unassigned')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterMode === 'unassigned' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          未指派
        </button>
      </div>
      <div className="text-[10px] text-stone-400 font-bold uppercase flex items-center gap-1">
        <Filter size={12} /> Filter
      </div>
    </div>
  );

  // 主儀表板畫面
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-emerald-200">

      {/* --- 黏性頁首 --- */}
      <header className="sticky top-0 z-30 transition-colors shadow-sm backdrop-blur-md border-b border-white/10 bg-emerald-700/95 text-white">
        <div className="max-w-5xl mx-auto px-4 h-14 md:h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
              <Tent className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-bold tracking-wide leading-none">CampSync</h1>
              <span className="text-[10px] font-mono opacity-80 leading-none mt-0.5 uppercase">ROOM: {roomId}</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-black/10 p-1 rounded-xl">
            <DesktopNavLink active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<ListIcon size={18} />} label="清單" />
            <DesktopNavLink active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')} icon={<ClipboardList size={18} />} label="個人清單" />
            <DesktopNavLink active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Wallet size={18} />} label="費用" />
            <DesktopNavLink active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} icon={<RefreshCw size={18} />} label="同步" />
          </nav>

          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 bg-black/20 pl-2 pr-3 py-1 rounded-full cursor-pointer hover:bg-black/30 transition-all active:scale-95"
              onClick={() => { if (window.confirm('登出房間？資料將保持同步')) { localStorage.removeItem('camp_room_id'); localStorage.removeItem('camp_room_password'); localStorage.removeItem('camp_current_user'); setIsRoomAuthenticated(false); setCurrentUser(null); } }}
            >
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <User size={14} />
              </div>
              <span className="text-xs font-bold text-white">{currentUser}</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- 通知提示 --- */}
      {notification && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl text-white font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${notification.type === 'error' ? 'bg-red-500' : 'bg-stone-800'}`}>
          {notification.type === 'error' ? <X size={18} /> : <Check size={18} />}
          <span className="text-sm">{notification.msg}</span>
        </div>
      )}

      {/* --- 主要內容 --- */}
      <main className="max-w-5xl mx-auto p-4 md:p-6 pb-28 md:pb-12 space-y-6">

        {/* 清單頁籤 */}
        {activeTab === 'list' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-center">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-stone-100 flex w-full max-w-md">
                <button onClick={() => setListMode('gear')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${listMode === 'gear' ? 'bg-emerald-100 text-emerald-800 shadow-sm' : 'text-stone-400 hover:bg-stone-50'}`}>
                  <Backpack size={16} /> 裝備
                </button>
                <button onClick={() => setListMode('food')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${listMode === 'food' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-stone-400 hover:bg-stone-50'}`}>
                  <Utensils size={16} /> 伙食
                </button>
              </div>
            </div>

            {listMode === 'gear' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 items-start">
                <div className="lg:sticky lg:top-20 order-1 lg:order-1">
                  <Card className="p-5 border-l-4 border-l-emerald-500 shadow-md">
                    <h3 className="font-bold text-lg mb-4 text-stone-700 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" /> 新增裝備</h3>
                    <div className="space-y-3">
                      <input type="text" placeholder="裝備名稱..." className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGearItem()} />
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <input type="number" min="1" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-center" value={newItemQuantity} onChange={(e) => setNewItemQuantity(e.target.value)} />
                          <span className="absolute right-3 top-3.5 text-stone-400 text-xs pointer-events-none font-bold">個</span>
                        </div>
                        <select className="flex-[2] p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 appearance-none" value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)}>
                          {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <Button variant="emerald" onClick={addGearItem} className="w-full py-3">加入清單</Button>
                    </div>
                  </Card>

                  {/* 裝備模板 */}
                  <Card className="p-5 border-l-4 border-l-stone-300">
                    <h3 className="font-bold text-lg mb-4 text-stone-700 flex items-center gap-2"><Download className="w-5 h-5 text-stone-500" /> 裝備模板</h3>
                    <div className="space-y-3">
                      {/* 儲存到 localStorage */}
                      <div className="flex gap-2">
                        <input
                          type="text" placeholder="模板名稱..."
                          className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                          value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && exportTemplate()}
                        />
                        <Button variant="secondary" onClick={exportTemplate} className="text-sm whitespace-nowrap">
                          <Upload size={14} /> 儲存
                        </Button>
                      </div>
                      {/* JSON 檔案上傳/下載 */}
                      <div className="flex gap-2">
                        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={uploadTemplateFromFile} />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex-1 text-sm">
                          <Upload size={14} /> 從檔案匯入
                        </Button>
                        <Button variant="secondary" onClick={downloadCurrentAsFile} className="flex-1 text-sm">
                          <Download size={14} /> 下載為檔案
                        </Button>
                      </div>
                      {savedTemplates.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-stone-100">
                          <p className="text-xs text-stone-400 font-bold">已存模板</p>
                          {savedTemplates.map((tpl, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-stone-50 p-3 rounded-xl">
                              <div className="flex items-center gap-2">
                                <Backpack size={14} className="text-emerald-500" />
                                <span className="text-sm font-bold text-stone-700">{tpl.name}</span>
                                <span className="text-xs text-stone-400">({tpl.items.length} 項)</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => importTemplate(tpl)} className="px-2 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all active:scale-95" title="載入">
                                  <Download size={12} className="inline" />
                                </button>
                                <button onClick={() => downloadTemplateAsFile(tpl)} className="px-2 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all active:scale-95" title="下載 JSON">
                                  <Upload size={12} className="inline" />
                                </button>
                                <button onClick={() => deleteTemplate(idx)} className="p-1 text-stone-300 hover:text-red-500 transition-colors" title="刪除">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="space-y-6 order-2 lg:order-2">
                  <FilterSwitch />

                  {groupedGear.length > 0 ? groupedGear.map(group => (
                    <div key={group.category} className="space-y-3">
                      <div className="flex items-center gap-2 pl-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider">{group.category}</h2>
                      </div>
                      <div className="grid gap-3">
                        {group.items.map(item => (
                          <ItemRow key={item.id} item={item} users={users} currentUser={currentUser} actions={{ togglePacked, updateAssignment, updateCost, deleteItem, updateSplitMembers, updateQuantity }} />
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center space-y-3 bg-white rounded-3xl border border-dashed border-stone-200">
                      <div className="bg-stone-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-stone-300">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="text-stone-400 text-sm font-medium">目前沒有符合條件的裝備</p>
                    </div>
                  )}
                  <AdBanner adSlot="1234567890" adClient="ca-pub-7253456466690152" />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <FilterSwitch />

                {/* 天數控制 */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-bold text-stone-500">天數</span>
                  <button onClick={removeDay} disabled={daysCount <= 1} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 disabled:opacity-30 transition-all active:scale-90"><Minus size={16} /></button>
                  <span className="text-lg font-bold text-stone-800 w-8 text-center">{daysCount}</span>
                  <button onClick={addDay} className="w-8 h-8 rounded-lg bg-amber-100 hover:bg-amber-200 flex items-center justify-center text-amber-700 transition-all active:scale-90"><Plus size={16} /></button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Array.from({ length: daysCount }).map((_, dayIndex) => (
                    <div key={dayIndex} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="bg-amber-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold shadow-sm">Day {dayIndex + 1}</span>
                        {/* 隱藏的餐別可加回 */}
                        {(hiddenMeals[dayIndex] || []).length > 0 && (
                          <div className="flex gap-1 items-center">
                            {(hiddenMeals[dayIndex] || []).map(hid => {
                              const meal = MEAL_TYPES.find(m => m.id === hid);
                              return meal ? (
                                <button key={hid} onClick={() => restoreMeal(hid, dayIndex)} className="px-2 py-1 text-xs font-bold bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 border border-amber-200 transition-all active:scale-95 flex items-center gap-1" title={`加回 ${meal.label}`}>
                                  <Plus size={10} />{meal.label}
                                </button>
                              ) : null;
                            })}
                          </div>
                        )}
                        <div className="h-0.5 bg-amber-100 flex-1 rounded-full"></div>
                      </div>
                      <div className="space-y-4">
                        {MEAL_TYPES.filter(m => !(hiddenMeals[dayIndex] || []).includes(m.id)).map(meal => {
                          const mealItems = items.filter(i => {
                            const isFood = i.type === 'food';
                            const isCorrectMeal = i.dayIndex === dayIndex && i.mealId === meal.id;
                            const filterMatch = filterMode === 'unpacked' ? !i.packed : filterMode === 'unassigned' ? !i.assignedTo : true;
                            return isFood && isCorrectMeal && filterMatch;
                          });

                          return (
                            <Card key={meal.id} className="p-0 border-l-4 border-l-amber-300">
                              <div className="bg-amber-50/50 p-3 flex justify-between items-center border-b border-amber-100/50">
                                <h3 className="font-bold text-stone-700 flex items-center gap-2 text-sm cursor-pointer group" onClick={() => {
                                  const name = window.prompt(`設定「${meal.label}」的菜色名稱`, mealDishNames[`${dayIndex}-${meal.id}`] || '');
                                  if (name !== null) setDishName(dayIndex, meal.id, name.trim());
                                }}>
                                  <span className="bg-white p-1.5 rounded-lg text-amber-600 shadow-sm">{meal.icon}</span>
                                  {meal.label}
                                  {mealDishNames[`${dayIndex}-${meal.id}`] && (
                                    <span className="text-xs font-bold text-amber-700 ml-1">— {mealDishNames[`${dayIndex}-${meal.id}`]}</span>
                                  )}
                                  <span className="text-[10px] text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                                </h3>
                                <div className="flex gap-1 items-center">
                                  <div className="flex gap-2 w-auto max-w-[180px]">
                                    <input type="text" placeholder="新增..." className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-400" value={newFoodInputs[`${dayIndex}-${meal.id}`] || ''} onChange={(e) => setNewFoodInputs({ ...newFoodInputs, [`${dayIndex}-${meal.id}`]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addFoodItem(dayIndex, meal.id)} />
                                    <button onClick={() => addFoodItem(dayIndex, meal.id)} className="bg-amber-500 text-white p-1.5 rounded-lg hover:bg-amber-600 shrink-0"><Plus size={16} /></button>
                                  </div>
                                  <button onClick={() => removeMeal(meal.id, dayIndex)} className="p-1 text-stone-300 hover:text-red-500 transition-colors shrink-0" title="刪除此餐別"><X size={14} /></button>
                                </div>
                              </div>
                              <div className="p-2 space-y-2"
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-amber-50'); }}
                                onDragLeave={(e) => { e.currentTarget.classList.remove('bg-amber-50'); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('bg-amber-50');
                                  const itemId = parseInt(e.dataTransfer.getData('text/plain'));
                                  if (itemId) moveItemToMeal(itemId, dayIndex, meal.id);
                                }}
                              >
                                {mealItems.length > 0 ? mealItems.map(item => (
                                  <div key={item.id}
                                    draggable
                                    onDragStart={(e) => {
                                      // 互動元素區域不觸發拖曳
                                      if (e.target.closest('[data-no-drag]')) { e.preventDefault(); return; }
                                      e.dataTransfer.setData('text/plain', String(item.id)); e.currentTarget.style.opacity = '0.4';
                                    }}
                                    onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                                    className="cursor-grab active:cursor-grabbing"
                                  >
                                    <ItemRow item={item} users={users} currentUser={currentUser} compact={true} actions={{ togglePacked, updateAssignment, updateCost, deleteItem, updateSplitMembers, updateQuantity }} />
                                  </div>
                                )) : (
                                  <div className="text-center py-2 text-xs text-stone-300 italic">
                                    {filterMode !== 'all' ? "此類別已完成" : "尚無安排"}
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <AdBanner adSlot="1234567890" adClient="ca-pub-7253456466690152" />
          </div>
        )}

        {/* 費用頁籤 */}
        {activeTab === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-teal-200">
                <h2 className="text-xl md:text-2xl font-bold mb-2 flex items-center gap-2 opacity-90"><Receipt className="w-6 h-6" /> 費用總覽</h2>
                <div className="mt-8 grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs md:text-sm font-medium opacity-70 mb-1">總支出</div>
                    <div className="text-3xl md:text-4xl font-bold tracking-tight">${settlementData.totalExpense}</div>
                  </div>
                  <div className="pl-6 border-l border-white/20">
                    <div className="text-xs md:text-sm font-medium opacity-70 mb-1">每人平均</div>
                    <div className="text-3xl md:text-4xl font-bold tracking-tight">${users.length > 0 ? Math.round(settlementData.totalExpense / users.length) : 0}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-stone-600 pl-2">結算建議</h3>
                {settlementData.transactions.length > 0 ? settlementData.transactions.map((t, idx) => (
                  <Card key={idx} className="p-4 flex justify-between items-center border-l-4 border-l-teal-400">
                    <div className="flex items-center gap-3 text-sm md:text-base">
                      <span className="font-bold px-2 py-0.5 rounded-md bg-stone-100">{t.from}</span>
                      <span className="text-stone-400">給</span>
                      <span className="font-bold px-2 py-0.5 rounded-md bg-stone-100">{t.to}</span>
                    </div>
                    <div className="font-bold text-teal-600 text-lg md:text-xl">${t.amount}</div>
                  </Card>
                )) : <p className="text-sm text-stone-400 italic pl-2">目前無須結算</p>}
              </div>
            </div>
            <div className="lg:col-span-7 space-y-6">
              <Card className="p-5 border-l-4 border-l-teal-500">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20} className="text-teal-500" /> 新增額外費用</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <input ref={expNameRef} type="text" placeholder="項目" className="col-span-2 md:col-span-1 p-2 bg-stone-50 border rounded-2xl" />
                  <input ref={expCostRef} type="number" placeholder="金額" className="p-2 bg-stone-50 border rounded-2xl" />
                  <select ref={expPayerRef} className="p-2 bg-stone-50 border rounded-2xl" defaultValue={currentUser}>
                    {users.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Button variant="teal" onClick={() => {
                    const n = expNameRef.current.value, c = expCostRef.current.value, p = expPayerRef.current.value;
                    if (n && c) addExpenseItem(n, c, p);
                    expNameRef.current.value = '';
                    expCostRef.current.value = '';
                  }}>新增</Button>
                </div>
              </Card>

              {/* 費用明細 */}
              {settlementData.expenseItems.length > 0 && (
                <Card className="p-5">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Receipt size={20} className="text-teal-500" /> 費用明細</h3>
                  <div className="space-y-3">
                    {settlementData.expenseItems.map(item => {
                      const splitTo = (item.splitMembers && item.splitMembers.length > 0) ? item.splitMembers : users;
                      const perPerson = splitTo.length > 0 ? Math.round(item.cost / splitTo.length) : 0;
                      return (
                        <div key={item.id} className="p-3 bg-stone-50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-800">{item.name}</span>
                              {item.quantity > 1 && <span className="text-xs text-stone-400">x{item.quantity}</span>}
                            </div>
                            <span className="font-bold text-teal-600">${item.cost}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-xs">
                            <span className="text-stone-400">付款:</span>
                            <span className="font-bold text-stone-600 bg-white px-2 py-0.5 rounded-md border border-stone-200">{item.assignedTo || '未指派'}</span>
                            <span className="text-stone-300 mx-1">│</span>
                            <span className="text-stone-400">分攤:</span>
                            {splitTo.map(u => (
                              <span key={u} className="font-bold text-stone-600 bg-white px-2 py-0.5 rounded-md border border-stone-200">{u}</span>
                            ))}
                            <span className="text-stone-400 ml-1">(每人 ${perPerson})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              <AdBanner adSlot="1234567890" adClient="ca-pub-7253456466690152" />
            </div>
          </div>
        )}

        {/* 同步頁籤 */}
        {activeTab === 'sync' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-6">
              <Card className="p-6 border-t-4 border-t-emerald-500">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-500" /> 雲端同步狀態
                </h3>
                <div className="space-y-4">
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-stone-400 uppercase">目前房間</span>
                      <span className="text-xs font-mono font-bold text-emerald-600">已加密連線</span>
                    </div>
                    <div className="text-xl font-black text-stone-800 font-mono tracking-wider">{roomId}</div>
                  </div>

                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <RefreshCw size={16} className="text-emerald-600 animate-spin-slow" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">即時同步中</h4>
                      <p className="text-xs text-emerald-600/80 mt-1">
                        系統已連接至 Firebase 雲端資料庫。所有變更都會在 0.5 秒內自動同步給所有連線中的成員，無需手動點擊儲存。
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Users /> 成員管理</h3>
                <div className="flex flex-wrap gap-2">
                  {users.map(user => (
                    <div key={user} className="bg-white border rounded-full pl-4 pr-1 py-1.5 flex items-center gap-2 shadow-sm">
                      <span className="text-sm font-bold">{user}</span>
                      <button onClick={() => removeUser(user)} className="p-1 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                  <input type="text" placeholder="新成員..." className="p-1.5 border-b outline-none text-sm w-24" onKeyDown={(e) => { if (e.key === 'Enter') { addUser(e.target.value); e.target.value = ''; } }} />
                </div>
              </Card>
            </div>
          </div>
        )}
        {/* ==== 個人清單分頁 ==== */}
        {activeTab === 'checklist' && (
          <div className="flex flex-col space-y-6 max-w-2xl mx-auto pb-24">
            <PersonalChecklist
              items={items}
              currentUser={currentUser}
              users={users}
              hiddenMeals={hiddenMeals}
              togglePacked={togglePacked}
            />
            <AdBanner adSlot="1234567890" adClient="ca-pub-7253456466690152" />
          </div>
        )}

      </main>

      {/* 手機版導覽列 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t pb-safe z-40 h-16 flex justify-around items-center">
        <MobileNavLink active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<LayoutGrid size={24} />} label="清單" color="text-emerald-600" />
        <MobileNavLink active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')} icon={<ClipboardList size={24} />} label="我的" color="text-indigo-600" />
        <MobileNavLink active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt size={24} />} label="費用" color="text-teal-600" />
        <MobileNavLink active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} icon={<RefreshCw size={24} />} label="同步" color="text-indigo-600" />
      </nav>
    </div>
  );
}

// --- 子元件 ---

const DesktopNavLink = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${active ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
    {icon} {label}
  </button>
);

const MobileNavLink = ({ active, onClick, icon, label, color }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full ${active ? color : 'text-stone-300'}`}>
    {icon} <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const LoginScreen = ({ users, onLogin, notification }) => {
  const inputRef = useRef(null);
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
      {notification && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl text-white font-medium ${notification.type === 'error' ? 'bg-red-500' : 'bg-stone-800'}`}>
          {notification.msg}
        </div>
      )}
      <Card className="w-full max-w-md p-8 space-y-8 shadow-xl">
        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto -rotate-6 shadow-lg shadow-emerald-50">
          <UserCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-stone-800">你是誰？</h1>
          <p className="text-stone-500 mt-2">請選擇現有成員或輸入新名字</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {users.map(u => (
            <button
              key={u}
              onClick={() => onLogin(u)}
              className="px-5 py-2.5 bg-white border border-stone-200 rounded-xl font-bold text-stone-600 hover:border-emerald-500 hover:text-emerald-600 hover:shadow-md transition-all active:scale-95"
            >
              {u}
            </button>
          ))}
        </div>
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-stone-200"></span></div>
          <div className="relative flex justify-center text-xs uppercase font-bold"><span className="bg-white px-3 text-stone-300">或新加入</span></div>
        </div>
        <input
          type="text"
          ref={inputRef}
          placeholder="輸入你的名字..."
          className="w-full p-4 border rounded-2xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500"
          onKeyDown={(e) => e.key === 'Enter' && onLogin(e.target.value)}
        />
        <Button variant="emerald" className="w-full py-4 text-lg" onClick={() => onLogin(inputRef.current?.value)}>進入清單</Button>
      </Card>
    </div>
  );
};

const ItemRow = ({ item, users, actions }) => {
  const [showSplit, setShowSplit] = useState(false);
  const effectiveSplit = (item.splitMembers && item.splitMembers.length > 0) ? item.splitMembers : users;
  const isCustomSplit = item.splitMembers && item.splitMembers.length > 0 && item.splitMembers.length < users.length;

  const toggleMember = (member) => {
    const current = (item.splitMembers && item.splitMembers.length > 0) ? [...item.splitMembers] : [...users];
    const idx = current.indexOf(member);
    if (idx >= 0) {
      if (current.length <= 1) return; // 至少保留 1 人
      current.splice(idx, 1);
    } else {
      current.push(member);
    }
    actions.updateSplitMembers(item.id, current);
  };

  return (
    <Card className={`p-3 ${item.packed ? 'bg-stone-50 opacity-70' : 'bg-white'}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => actions.togglePacked(item.id)} className={item.packed ? 'text-emerald-500' : 'text-stone-300'}>
          {item.packed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
        </button>
        <span className={`flex-1 font-bold ${item.packed ? 'line-through' : ''}`}>{item.name} {item.quantity > 1 && <span className="text-xs text-stone-400">x{item.quantity}</span>}</span>
        <div className="flex items-center gap-2" data-no-drag>
          <div className="flex items-center bg-stone-50 px-2 py-1 rounded-lg border border-stone-100">
            <span className="text-[10px] text-stone-400 mr-1">$</span>
            <input type="number" min="0" className="w-12 bg-transparent text-right text-sm font-bold outline-none" value={item.cost || ''} onChange={(e) => actions.updateCost(item.id, e.target.value)} placeholder="0" />
          </div>
          <select className="text-xs border rounded-lg p-1.5 bg-white font-bold text-stone-600 outline-none focus:ring-1 focus:ring-emerald-500" value={item.assignedTo || ""} onChange={(e) => actions.updateAssignment(item.id, e.target.value)}>
            <option value="">未指派</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => actions.deleteItem(item.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
        </div>
      </div>
      {/* 分攤 UI — 有費用時顯示 */}
      {item.cost > 0 && (
        <div className="mt-2 pt-2 border-t border-stone-100">
          <button
            onClick={() => setShowSplit(!showSplit)}
            className={`text-xs font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${isCustomSplit ? 'text-amber-600 bg-amber-50' : 'text-stone-400 hover:bg-stone-50'}`}
          >
            <Users size={12} />
            分攤: {isCustomSplit ? `${effectiveSplit.length}/${users.length} 人` : '全員'}
            <span className="text-[10px]">{showSplit ? '▲' : '▼'}</span>
          </button>
          {showSplit && (
            <div className="flex flex-wrap gap-1.5 mt-2 animate-in fade-in">
              {users.map(u => {
                const included = effectiveSplit.includes(u);
                return (
                  <button
                    key={u}
                    onClick={() => toggleMember(u)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all active:scale-95 ${included
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-stone-50 border-stone-200 text-stone-400 line-through'
                      }`}
                  >
                    {included ? <Check size={10} className="inline mr-1" /> : <X size={10} className="inline mr-1" />}
                    {u}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const PersonalChecklist = ({ items, currentUser, hiddenMeals, togglePacked }) => {
  if (!currentUser) {
    return (
      <Card className="text-center p-8 bg-white border-dashed">
        <div className="text-stone-400 mb-2">請先加入或選擇你的名字</div>
      </Card>
    );
  }

  const myItems = items.filter(i => i.assignedTo === currentUser);

  const isHiddenFood = (item) => {
    if (item.type !== 'food') return false;
    return (hiddenMeals[item.dayIndex] || []).includes(item.mealId);
  };

  const cancelledItems = myItems.filter(isHiddenFood);
  const activeItems = myItems.filter(i => !isHiddenFood(i));
  const unpackedItems = activeItems.filter(i => !i.packed);
  const packedItems = activeItems.filter(i => i.packed);

  const Section = ({ title, list, icon, emptyMsg, className: cx = "" }) => (
    <div className={`space-y-3 ${cx}`}>
      <h3 className="font-bold text-stone-600 flex items-center gap-2 border-b pb-2">
        {icon} {title} <span className="text-stone-400 font-normal text-sm">({list.length})</span>
      </h3>
      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-stone-100">
              <button onClick={() => togglePacked(item.id)} className={`shrink-0 transition-colors ${item.packed ? 'text-emerald-500' : 'text-stone-300 hover:text-stone-400'}`}>
                {item.packed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
              <div className="flex flex-col">
                <span className={`font-bold ${item.packed ? 'line-through text-stone-500' : 'text-stone-800'}`}>
                  {item.name} {item.quantity > 1 && <span className="text-xs text-stone-400">x{item.quantity}</span>}
                </span>
                <span className="text-[10px] text-stone-400 flex items-center gap-1">
                  {item.type === 'food' ? <Utensils size={10} /> : <Tent size={10} />}
                  {item.type === 'food' ? `Day ${item.dayIndex + 1} 伙食` : (item.category || '裝備')}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-stone-400 italic text-center py-4 bg-stone-50 rounded-xl">{emptyMsg}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
            <ClipboardList size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black">嗨，{currentUser}！</h2>
            <p className="text-indigo-100/90 text-sm mt-1">
              這是你專屬的準備清單，目前有 <strong className="text-white">{unpackedItems.length}</strong> 項任務待完成。
            </p>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10 blur-[2px] pointer-events-none transform -rotate-12 scale-150">
          <ClipboardList size={120} />
        </div>
      </div>

      <div className="px-2 space-y-8 pb-10">
        <Section title="待準備 (未勾選)" list={unpackedItems} icon={<Circle size={18} className="text-amber-500" />} emptyMsg="太棒了！目前沒有待準備的項目。" />
        <Section title="已準備 (已勾選)" list={packedItems} icon={<CheckCircle2 size={18} className="text-emerald-500" />} emptyMsg="尚無已準備的項目。" className="opacity-80" />
        <Section title="已取消 (隱藏餐別)" list={cancelledItems} icon={<X size={18} className="text-red-400" />} emptyMsg="無取消項目。" className="opacity-50 grayscale" />
      </div>
    </div>
  );
};

// --- 廣告 Banner 元件 ---
// 使用方式：
//   1. 串接 Google AdSense：在 index.html 加入 AdSense script，然後傳入 adSlot prop
//      <AdBanner adSlot="1234567890" adClient="ca-pub-XXXXXXXXXXXXXXXX" />
//   2. 不傳 prop 時顯示 placeholder 輪播（開發模式）
const AdBanner = ({ adSlot, adClient, className = '' }) => {
  const bannerRef = React.useRef(null);
  const [slide, setSlide] = React.useState(0);

  const slides = [
    {
      bg: 'from-emerald-500 to-teal-600',
      emoji: '🏕️',
      title: 'CampSync Pro',
      sub: '升級後解鎖無限行程、匯出 PDF 等功能',
      cta: '了解更多',
      href: '#',
    },
    {
      bg: 'from-amber-400 to-orange-500',
      emoji: '🪵',
      title: '露營裝備推薦',
      sub: 'Decathlon × CampSync 精選好物一鍵加清單',
      cta: '立即選購',
      href: '#',
    },
    {
      bg: 'from-indigo-500 to-violet-600',
      emoji: '🗺️',
      title: '台灣露營地圖',
      sub: '超過 500 個營地評分，輕鬆找到夢想山頭',
      cta: '搜尋營地',
      href: '#',
    },
  ];

  // 若有 adSlot 就注入 AdSense
  React.useEffect(() => {
    if (adSlot && bannerRef.current) {
      try {
        const adsbygoogle = window.adsbygoogle || [];
        adsbygoogle.push({});
      } catch (e) {
        // ignore
      }
    }
  }, [adSlot]);

  // placeholder 自動輪播
  React.useEffect(() => {
    if (adSlot) return;
    const timer = setInterval(() => setSlide(s => (s + 1) % slides.length), 4000);
    return () => clearInterval(timer);
  }, [adSlot]);

  if (adSlot) {
    return (
      <div className={`w-full overflow-hidden rounded-2xl mt-4 ${className}`} style={{ minHeight: 90 }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: 90 }}
          data-ad-client={adClient || 'ca-pub-XXXXXXXXXXXXXXXX'}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
          ref={bannerRef}
        />
      </div>
    );
  }

  const cur = slides[slide];
  return (
    <div className={`w-full rounded-2xl overflow-hidden shadow-md mt-4 ${className}`}>
      <a
        href={cur.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-4 px-5 py-4 bg-gradient-to-r ${cur.bg} text-white transition-all duration-700`}
      >
        <span className="text-3xl shrink-0 drop-shadow">{cur.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-black text-sm leading-tight truncate">{cur.title}</div>
          <div className="text-xs opacity-80 mt-0.5 truncate">{cur.sub}</div>
        </div>
        <span className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
          {cur.cta} →
        </span>
      </a>
      {/* 輪播指示點 */}
      <div className="flex justify-center gap-1.5 py-1.5 bg-stone-100">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === slide ? 'bg-stone-600 w-4' : 'bg-stone-300'
              }`}
          />
        ))}
      </div>
    </div>
  );
};
