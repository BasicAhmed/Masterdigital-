import { getRates } from "@/lib/rates";
import { getContactSettings, getDisabledFlows } from "@/lib/settings";
import { ContactProvider } from "@/components/ContactContext";
import WhatsAppFab from "@/components/WhatsAppFab";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import RateTicker from "@/components/RateTicker";
import RatesTable from "@/components/RatesTable";
import WhyChoose from "@/components/WhyChoose";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Suggestions from "@/components/Suggestions";
import Footer from "@/components/Footer";

export const revalidate = 60; // re-fetch rates at most once a minute

export default async function Home() {
  const [rates, disabledFlows, contact] = await Promise.all([getRates(), getDisabledFlows(), getContactSettings()]);

  return (
    <ContactProvider value={contact}>
      <Nav />
      <Hero rates={rates} disabledFlows={disabledFlows} />
      <RateTicker rates={rates} disabledFlows={disabledFlows} />
      <RatesTable rates={rates} disabledFlows={disabledFlows} />
      <WhyChoose />
      <HowItWorks />
      <FAQ />
      <Suggestions />
      <Contact />
      <Footer />
      <WhatsAppFab />
    </ContactProvider>
  );
}
