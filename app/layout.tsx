import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWAUpdater from "./components/PWAUpdater";
import { ThemeProvider } from "./components/ThemeProvider";
import OrderAssistant from "./components/OrderAssistant";
import PushAutoSubscriber from "./components/PushAutoSubscriber";
import { siteUrl } from "@/lib/siteUrl";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const SITE = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "YourResearchWriter | Research, Writing, Software & Creative Services",
    template: "%s | YourResearchWriter",
  },
  description:
    "Expert research & academic writing, content, executive resumes, and full-stack software development. Rigorously vetted, plagiarism-free, delivered on time.",
  keywords: [
    "research writing", "academic writing", "dissertation help", "thesis writing",
    "content writing", "resume writing", "software development", "Nigeria",
  ],
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "YourResearchWriter",
    title: "YourResearchWriter | Research, Writing, Software & Creative Services",
    description:
      "Expert research & academic writing, content, executive resumes, and full-stack software development. Rigorously vetted, plagiarism-free, delivered on time.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "YourResearchWriter",
    description:
      "Expert research & academic writing, content, resumes, and software development.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YRW",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "YourResearchWriter",
              url: SITE,
              email: "yourwriterofficial@gmail.com",
              description:
                "Expert research & academic writing, content, executive resumes, and full-stack software development.",
              areaServed: "Worldwide",
              sameAs: ["https://wa.me/2348121443666"],
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <PWAUpdater />
          <PushAutoSubscriber />
          {children}
          <OrderAssistant />
          {/* Floating WhatsApp Support Button */}
          <a
            href="https://wa.me/2348121443666"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 bg-[#25D366] p-3 rounded-full shadow-lg hover:bg-[#20b859] transition"
            aria-label="Chat on WhatsApp"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12.031 2.01c-5.52 0-9.998 4.478-9.998 9.998 0 1.76.457 3.479 1.33 4.989L2 21.99l5.25-1.42a9.93 9.93 0 0 0 4.781 1.198c5.52 0 9.998-4.477 9.998-9.998 0-5.52-4.477-9.998-9.998-9.998zm5.675 13.957c-.375.943-1.823 1.773-2.749 1.87-.583.06-1.159.116-2.062-.218-1.158-.435-2.822-1.743-3.874-2.853-1.5-1.59-2.166-2.957-2.374-3.77-.208-.812-.042-1.395.11-1.79.12-.312.375-.674.568-.87.193-.197.266-.28.416-.475.145-.196.258-.324.394-.54.136-.216.08-.406-.019-.6-.102-.195-.757-1.97-1.03-2.685-.262-.684-.524-.68-.76-.68-.199 0-.417-.012-.635-.012a2.09 2.09 0 0 0-1.456.66c-.858.86-1.619 1.882-1.619 3.36 0 1.76 1.31 3.66 1.799 4.22.49.56 2.644 4.2 6.238 5.86 1.213.56 2.202.83 2.997.96 1.198.195 2.416.138 3.26-.07.808-.197 1.748-.848 2.018-1.68.27-.831.27-1.63.135-1.93-.135-.3-.375-.49-.745-.637-.37-.147-2.224-1.142-2.562-1.268-.337-.126-.506-.2-.689.23-.183.43-.624.637-.774.813-.15.176-.3.211-.645.084-.344-.127-1.507-.56-2.864-1.78-1.052-.946-1.821-2.144-2.023-2.466-.201-.322-.028-.496.08-.64.113-.146.256-.293.39-.44.133-.147.177-.254.255-.423.077-.169.038-.292-.01-.412-.047-.12-.39-1.035-.676-1.86-.12-.352-.24-.694-.346-.98-.079-.21-.189-.393-.349-.54a2.28 2.28 0 0 0-.874-.509c-.378-.106-.782-.137-1.112-.137-.203 0-.412.02-.627.054-.63.095-1.36.39-1.85.914-.766.82-1.19 1.89-1.19 2.99 0 1.05.263 1.88.596 2.58.399.84.792 1.502 1.341 2.172.45.555.997 1.034 1.563 1.445 1.218.884 2.63 1.467 3.88 1.877.882.29 1.757.512 2.539.626.792.116 1.606.12 2.287.035.632-.08 1.511-.234 2.232-.757.782-.567 1.3-1.362 1.474-2.129.164-.708.179-1.388.104-1.83-.067-.395-.26-.793-.504-1.074-.256-.293-.547-.499-.853-.652-.263-.132-.542-.227-.831-.309z" />
            </svg>
          </a>
        </ThemeProvider>
      </body>
    </html>
  );
}