import { STATUS_LABEL, downloadCsv, type Transaction } from "@/lib/data";
import { todayStr } from "@/lib/format";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function exportTransactions(txs: Transaction[], name = "transactions") {
  downloadCsv(`master-digital-${name}-${todayStr()}.csv`, [
    [
      "المرجع", "التاريخ", "العميل", "المسار", "من عملة", "إلى عملة", "المبلغ", "سعر العميل", "سعر التكلفة",
      "الرسوم", "عملة الرسوم", "التكاليف", "عملة التكاليف", "المبلغ المستلم", "هامش المسار %",
      "الحجم (USD)", "الإيراد (USD)", "الربح (USD)", "طريقة الدفع", "طريقة التسليم", "المستلم", "الحالة", "ملاحظات", "سجّلها", "آخر تعديل",
    ],
    ...txs.map((t) => [
      t.ref, t.date, t.customerName, `${t.from} → ${t.to}`, t.from, t.to, t.amount, t.rate, t.cost,
      t.fee, t.feeSide === "from" ? t.from : t.to, t.expense, t.expenseSide === "from" ? t.from : t.to,
      r2(t.payout), r2(t.marginPercent), r2(t.volumeUsd), r2(t.revenueUsd), r2(t.profitUsd),
      t.payMethod, t.payoutMethod, t.recipient, STATUS_LABEL[t.status], t.notes, t.createdByName ?? "", t.updatedByName ?? "",
    ]),
  ]);
}
