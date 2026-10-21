import type { Metadata } from "next";

/** The admin system keeps the Master Digital name; the public site is «تحديث سعر الصرف». */
export const metadata: Metadata = {
  title: "Master Digital — لوحة الإدارة",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
