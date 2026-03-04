                  </Button>
                  <div className="flex justify-center">
                    <button
                      onClick={() => { if (window.confirm("蝣箏?閬??啣??脩垢?湔鞈???")) syncWithGoogleSheet('read', roomId); }}
                      className="text-xs text-stone-400 hover:text-emerald-600 underline underline-offset-4 decoration-stone-200"
                    >
                      ??敺蝡臬?甇?                    </button>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Users /> ?蝞∠?</h3>
                <div className="flex flex-wrap gap-2">
                  {users.map(user => (
                    <div key={user} className="bg-white border rounded-full pl-4 pr-1 py-1.5 flex items-center gap-2 shadow-sm">
                      <span className="text-sm font-bold">{user}</span>
                      <button onClick={() => removeUser(user)} className="p-1 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                  <input type="text" placeholder="?唳???.." className="p-1.5 border-b outline-none text-sm w-24" onKeyDown={(e) => { if (e.key === 'Enter') { addUser(e.target.value); e.target.value = ''; } }} />
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* ????閬賢? */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t pb-safe z-40 h-16 flex justify-around items-center">
        <MobileNavLink active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<LayoutGrid size={24} />} label="皜" color="text-emerald-600" />
        <MobileNavLink active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt size={24} />} label="鞎餌" color="text-teal-600" />
        <MobileNavLink active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} icon={<RefreshCw size={24} />} label="?郊" color="text-indigo-600" />
      </nav>
    </div>
  );
}

// --- 摮?隞?---

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
          <h1 className="text-3xl font-black text-stone-800">雿隤堆?</h1>
          <p className="text-stone-500 mt-2">隢????⊥?頛詨?啣?摮?/p>
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
          <div className="relative flex justify-center text-xs uppercase font-bold"><span className="bg-white px-3 text-stone-300">??</span></div>
        </div>
        <input
          type="text"
          ref={inputRef}
          placeholder="頛詨雿???..."
          className="w-full p-4 border rounded-2xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500"
          onKeyDown={(e) => e.key === 'Enter' && onLogin(e.target.value)}
        />
        <Button variant="emerald" className="w-full py-4 text-lg" onClick={() => onLogin(inputRef.current?.value)}>?脣皜</Button>
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
      if (current.length <= 1) return; // ?喳?靽? 1 鈭?      current.splice(idx, 1);
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
            <option value="">?芣?瘣?/option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => actions.deleteItem(item.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
        </div>
      </div>
      {/* ? UI ???祥?冽?憿舐內 */}
      {item.cost > 0 && (
        <div className="mt-2 pt-2 border-t border-stone-100">
          <button
            onClick={() => setShowSplit(!showSplit)}
            className={`text-xs font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${isCustomSplit ? 'text-amber-600 bg-amber-50' : 'text-stone-400 hover:bg-stone-50'}`}
          >
            <Users size={12} />
            ?: {isCustomSplit ? `${effectiveSplit.length}/${users.length} 鈭槁 : '?典'}
            <span className="text-[10px]">{showSplit ? '?? : '??}</span>
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
