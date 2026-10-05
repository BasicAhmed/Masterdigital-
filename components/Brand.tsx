import Image from "next/image";

/** Logo + wordmark. The shield always sits on a white tile. */
export default function Brand({ size = 40, sub }: { size?: number; sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="logo-tile shrink-0" style={{ width: size, height: size }}>
        <Image src="/logo.png" alt="Master Digital" width={size * 2} height={size * 2} className="h-full w-full object-contain" priority />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-extrabold tracking-wide text-ink" dir="ltr">
          MASTER <span className="text-primary">DIGITAL</span>
        </span>
        <span className="block text-[10.5px] font-medium text-subtle">{sub ?? "ماستر للخدمات المصرفية"}</span>
      </span>
    </span>
  );
}
