// --- 費用結算邏輯 ---
export const calculateDebts = (balances) => {
    let debtors = [];
    let creditors = [];
    Object.entries(balances).forEach(([user, amount]) => {
        if (amount < -0.01) debtors.push({ user, amount });
        if (amount > 0.01) creditors.push({ user, amount });
    });
    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    let transactions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        let debtor = debtors[i], creditor = creditors[j];
        let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        amount = Math.round(amount * 100) / 100;
        if (amount > 0) transactions.push({ from: debtor.user, to: creditor.user, amount: amount });
        debtor.amount += amount; debtor.amount = Math.round(debtor.amount * 100) / 100;
        creditor.amount -= amount; creditor.amount = Math.round(creditor.amount * 100) / 100;
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (Math.abs(creditor.amount) < 0.01) j++;
    }
    return transactions;
};

// --- 結算資料計算 ---
export const computeSettlement = (items, users) => {
    const balances = {};
    users.forEach(u => balances[u] = 0);
    let totalExpense = 0;
    const expenseItems = [];
    items.forEach(item => {
        if (item.cost > 0) {
            expenseItems.push(item);
            totalExpense += item.cost;
            const payer = item.assignedTo;
            if (payer && users.includes(payer)) balances[payer] += item.cost;
            const beneficiaries = (item.splitMembers && item.splitMembers.length > 0) ? item.splitMembers.filter(u => users.includes(u)) : users;
            if (beneficiaries.length > 0) {
                const share = item.cost / beneficiaries.length;
                beneficiaries.forEach(b => balances[b] -= share);
            }
        }
    });
    return { balances, totalExpense, transactions: calculateDebts(balances), expenseItems };
};

// --- 分攤成員更新 ---
export const getUpdatedSplitMembers = (currentSplit, users, memberId) => {
    const current = (currentSplit && currentSplit.length > 0) ? [...currentSplit] : [...users];
    const idx = current.indexOf(memberId);
    if (idx >= 0) {
        if (current.length <= 1) return current; // 至少保留 1 人
        current.splice(idx, 1);
    } else {
        current.push(memberId);
    }
    // 如果全員參與，回傳 null
    if (current.length === users.length && users.every(u => current.includes(u))) return null;
    return current;
};

// --- 模板驗證 ---
export const validateTemplate = (data) => {
    if (!data || typeof data !== 'object') return { valid: false, error: '無效的資料格式' };
    if (!data.items || !Array.isArray(data.items)) return { valid: false, error: '缺少 items 陣列' };
    if (data.items.length === 0) return { valid: false, error: '模板內容為空' };
    for (const item of data.items) {
        if (!item.name || typeof item.name !== 'string') return { valid: false, error: `項目缺少有效名稱` };
    }
    return { valid: true, template: { name: data.name || '未命名', items: data.items, createdAt: data.createdAt || new Date().toISOString() } };
};

// --- 模板匯出格式化 ---
export const formatGearForExport = (items) => {
    return items
        .filter(i => i.type === 'gear')
        .map(({ name, category, quantity }) => ({ name, category: category || '其他', quantity: quantity || 1 }));
};

// --- 常數 ---
export const INITIAL_CATEGORIES = ['睡眠裝備', '廚房炊具', '食物飲水', '休閒娛樂', '照明工具', '其他'];
