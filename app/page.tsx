import { getRoutes } from "@/lib/routes";
import { getContactSettings } from "@/lib/settings";
import { ContactProvider } from "@/components/ContactContext";
import WhatsAppFab from "@/components/WhatsAppFab";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import RatesBoard from "@/components/RatesBoard";
import Calculator from "@/components/Calculator";
import WhyChoose from "@/components/WhyChoose";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export const revalidate = 60; // re-fetch rates at most once a minute

export default async function Home() {
  const [routes, contact] = await Promise.all([getRoutes(), getContactSettings()]);

  return (
    <ContactProvider value={contact}>
      <Nav />
      <Hero />
      <RatesBoard routes={routes} />
      <Calculator routes={routes} />
      <WhyChoose />
      <HowItWorks />
      <FAQ />
      <Contact />
      <Footer />
      <WhatsAppFab />
    </ContactProvider>
  );
}
