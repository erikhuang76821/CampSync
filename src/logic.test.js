import { describe, it, expect } from 'vitest';
import {
    calculateDebts,
    computeSettlement,
    getUpdatedSplitMembers,
    validateTemplate,
    formatGearForExport,
    INITIAL_CATEGORIES,
} from './logic';

// ============================================================
// calculateDebts
// ============================================================
describe('calculateDebts', () => {
    it('無負債時回傳空陣列', () => {
        expect(calculateDebts({ A: 0, B: 0 })).toEqual([]);
    });

    it('兩人簡單結算', () => {
        // A 多付 100，B 欠 100
        const result = calculateDebts({ A: 100, B: -100 });
        expect(result).toEqual([{ from: 'B', to: 'A', amount: 100 }]);
    });

    it('三人結算', () => {
        // A 多付 200，B 欠 100，C 欠 100
        const result = calculateDebts({ A: 200, B: -100, C: -100 });
        expect(result).toHaveLength(2);
        const totalRepaid = result.reduce((sum, t) => sum + t.amount, 0);
        expect(totalRepaid).toBe(200);
    });

    it('處理浮點數精度', () => {
        const result = calculateDebts({ A: 33.33, B: -16.665, C: -16.665 });
        result.forEach(t => {
            expect(Number.isFinite(t.amount)).toBe(true);
            expect(t.amount).toBeGreaterThan(0);
        });
    });

    it('極小差異不產生交易', () => {
        const result = calculateDebts({ A: 0.001, B: -0.001 });
        expect(result).toEqual([]);
    });
});

// ============================================================
// computeSettlement
// ============================================================
describe('computeSettlement', () => {
    const users = ['傑克', '愛麗絲', '湯姆'];

    it('沒有費用時回傳零', () => {
        const items = [
            { id: 1, type: 'gear', name: '帳篷', cost: 0, assignedTo: '傑克', splitMembers: null },
        ];
        const result = computeSettlement(items, users);
        expect(result.totalExpense).toBe(0);
        expect(result.expenseItems).toHaveLength(0);
        expect(result.transactions).toEqual([]);
    });

    it('全員均攤 — 一筆費用', () => {
        const items = [
            { id: 1, type: 'gear', name: '瓦斯罐', cost: 300, assignedTo: '傑克', splitMembers: null },
        ];
        const result = computeSettlement(items, users);
        expect(result.totalExpense).toBe(300);
        // 傑克付 300，均攤每人 100
        // 傑克餘額 = 300 - 100 = 200
        expect(result.balances['傑克']).toBe(200);
        expect(result.balances['愛麗絲']).toBe(-100);
        expect(result.balances['湯姆']).toBe(-100);
    });

    it('自訂分攤 — 排除部分成員', () => {
        const items = [
            { id: 1, type: 'gear', name: '酒', cost: 200, assignedTo: '傑克', splitMembers: ['傑克', '愛麗絲'] },
        ];
        const result = computeSettlement(items, users);
        // 只有傑克和愛麗絲分攤，每人 100
        expect(result.balances['傑克']).toBe(100); // 付 200，攤 100
        expect(result.balances['愛麗絲']).toBe(-100);
        expect(result.balances['湯姆']).toBe(0); // 不參與
    });

    it('多筆費用累加', () => {
        const items = [
            { id: 1, type: 'gear', name: '帳篷', cost: 300, assignedTo: '傑克', splitMembers: null },
            { id: 2, type: 'food', name: '肉', cost: 150, assignedTo: '愛麗絲', splitMembers: null },
        ];
        const result = computeSettlement(items, users);
        expect(result.totalExpense).toBe(450);
        expect(result.expenseItems).toHaveLength(2);
    });

    it('付款人不在 users 裡時不計入餘額', () => {
        const items = [
            { id: 1, type: 'gear', name: '帳篷', cost: 300, assignedTo: '路人', splitMembers: null },
        ];
        const result = computeSettlement(items, users);
        expect(result.totalExpense).toBe(300);
        // 每人仍均攤 100，但沒人的餘額是正的
        expect(result.balances['傑克']).toBe(-100);
    });

    it('空的 splitMembers 視為全員', () => {
        const items = [
            { id: 1, type: 'gear', name: 'X', cost: 300, assignedTo: '傑克', splitMembers: [] },
        ];
        const result = computeSettlement(items, users);
        // splitMembers=[] → fallback 全員
        expect(result.balances['傑克']).toBe(200);
    });
});

// ============================================================
// getUpdatedSplitMembers
// ============================================================
describe('getUpdatedSplitMembers', () => {
    const users = ['A', 'B', 'C'];

    it('從全員移除一人', () => {
        const result = getUpdatedSplitMembers(null, users, 'C');
        expect(result).toEqual(['A', 'B']);
    });

    it('加回被移除的人 → 變回全員回傳 null', () => {
        const result = getUpdatedSplitMembers(['A', 'B'], users, 'C');
        expect(result).toBeNull();
    });

    it('只剩一人時拒絕移除', () => {
        const result = getUpdatedSplitMembers(['A'], users, 'A');
        expect(result).toEqual(['A']); // 不變
    });

    it('空 splitMembers 視為全員', () => {
        const result = getUpdatedSplitMembers([], users, 'B');
        expect(result).toEqual(['A', 'C']);
    });
});

// ============================================================
// validateTemplate
// ============================================================
describe('validateTemplate', () => {
    it('有效模板', () => {
        const data = {
            name: '測試模板',
            items: [
                { name: '帳篷', category: '睡眠裝備', quantity: 1 },
                { name: '睡袋', category: '睡眠裝備', quantity: 2 },
            ],
        };
        const result = validateTemplate(data);
        expect(result.valid).toBe(true);
        expect(result.template.name).toBe('測試模板');
        expect(result.template.items).toHaveLength(2);
    });

    it('null 輸入', () => {
        expect(validateTemplate(null).valid).toBe(false);
    });

    it('缺少 items', () => {
        expect(validateTemplate({ name: 'x' }).valid).toBe(false);
    });

    it('items 不是陣列', () => {
        expect(validateTemplate({ items: 'abc' }).valid).toBe(false);
    });

    it('空 items', () => {
        expect(validateTemplate({ items: [] }).valid).toBe(false);
    });

    it('項目缺少 name', () => {
        expect(validateTemplate({ items: [{ category: 'x' }] }).valid).toBe(false);
    });

    it('沒有 name 欄位時預設「未命名」', () => {
        const data = { items: [{ name: '帳篷' }] };
        const result = validateTemplate(data);
        expect(result.valid).toBe(true);
        expect(result.template.name).toBe('未命名');
    });
});

// ============================================================
// formatGearForExport
// ============================================================
describe('formatGearForExport', () => {
    it('只匯出 gear 類型', () => {
        const items = [
            { id: 1, type: 'gear', name: '帳篷', category: '睡眠裝備', quantity: 1, cost: 500, assignedTo: '傑克' },
            { id: 2, type: 'food', name: '牛肉', category: null, quantity: 1 },
            { id: 3, type: 'gear', name: '爐子', category: '廚房炊具', quantity: 2, cost: 200 },
        ];
        const result = formatGearForExport(items);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ name: '帳篷', category: '睡眠裝備', quantity: 1 });
        expect(result[1]).toEqual({ name: '爐子', category: '廚房炊具', quantity: 2 });
    });

    it('空清單', () => {
        expect(formatGearForExport([])).toEqual([]);
    });

    it('預設值填補', () => {
        const items = [{ id: 1, type: 'gear', name: '繩子' }];
        const result = formatGearForExport(items);
        expect(result[0].category).toBe('其他');
        expect(result[0].quantity).toBe(1);
    });
});

// ============================================================
// INITIAL_CATEGORIES
// ============================================================
describe('INITIAL_CATEGORIES', () => {
    it('包含 6 個分類', () => {
        expect(INITIAL_CATEGORIES).toHaveLength(6);
    });

    it('包含「其他」', () => {
        expect(INITIAL_CATEGORIES).toContain('其他');
    });
});
