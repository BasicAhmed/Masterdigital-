import Image from "next/image";

/** The public website's brand: «تحديث سعر الصرف». (The admin system keeps
 *  its own Master Digital brand — see Brand.tsx.) */
export const SITE_NAME = "تحديث سعر الصرف";

export default function SiteBrand({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/brand/site-logo-sm.png" alt={SITE_NAME} width={size * 2} height={size * 2} className="shrink-0 rounded-full" style={{ width: size, height: size }} priority />
      <span className="font-display text-[15px] font-extrabold leading-tight text-ink">
        تحديث <span className="text-brand-gold">سعر الصرف</span>
      </span>
    </span>
  );
}
