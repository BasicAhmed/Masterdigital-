import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Master Digital — ماستر للخدمات المصرفية | تحويلات سريعة خلال دقائق",
  description:
    "تحويلات سريعة وآمنة بين الجنيه السوداني والجنيه المصري والشلن الأوغندي والفرنك الرواندي والشلن الكيني والريال السعودي والدرهم الإماراتي والدولار و USDT. أسعار محدثة باستمرار وخدمة عملاء على مدار اليوم.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  openGraph: {
    title: "Master Digital — ماستر للخدمات المصرفية",
    description: "تحويلات سريعة خلال دقائق.",
    type: "website",
    images: ["/og.png"],
  },
};

export const viewport = { themeColor: "#072969" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-ink font-body antialiased transition-colors duration-300 ">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
