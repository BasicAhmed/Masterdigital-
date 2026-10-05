import { CURRENCIES } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import type { RateRow } from "@/lib/rates";

/** The shield's black ribbon with its gold thread, carrying live rates. */
export default function RateTicker({ rates, disabledFlows = [] }: { rates: RateRow[]; disabledFlows?: string[] }) {
  const active = rates.filter((r) => !disabledFlows.includes(`${r.from}_${r.to}`));
  const loop = [...active, ...active]; // duplicated for seamless scroll

  return (
    <div className="ribbon overflow-hidden py-3.5">
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#07090f] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#07090f] to-transparent" />
      <div className="flex w-max animate-ticker gap-10 whitespace-nowrap" dir="ltr">
        {loop.map((r, i) => {
          const from = CURRENCIES[r.from];
          const to = CURRENCIES[r.to];
          return (
            <div key={i} className="flex items-center gap-2.5 font-mono text-sm">
              <span className="text-white/65">
                {from.flag} {r.from} → {to.flag} {r.to}
              </span>
              <span className="font-bold text-[#e6c260]">{formatRate(r.rate)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
