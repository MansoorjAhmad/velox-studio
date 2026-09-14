import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://veloxstudio.app";
const APP_NAME = "Velox Studio";
const APP_TITLE = "Velox Studio — Trading Journal & Risk Calculator";
const APP_DESCRIPTION =
  "The complete trader OS: precision position size calculator (Gold, Forex, NAS100), TradeZella-grade journal, Zenith AI insights, personal finance, goals, and daily routine — 100% free.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: APP_TITLE,
    template: "%s · Velox Studio",
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "Velox Studio", url: APP_URL }],
  keywords: [
    "trading journal",
    "position size calculator",
    "risk calculator",
    "forex calculator",
    "XAUUSD lot size",
    "gold trading calculator",
    "cent account calculator",
    "trade journal",
    "trading analytics",
    "risk management",
    "velox studio",
  ],

  // ── Open Graph (Facebook, WhatsApp, LinkedIn, Discord) ──
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Velox Studio — Trading Journal & Risk Calculator",
      },
    ],
  },

  // ── Twitter / X Card ──
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@veloxstudio",
  },

  // ── Robots ──
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Canonical ──
  alternates: {
    canonical: APP_URL,
  },

  // ── Icons ──
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  // ── Manifest ──
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#efece4",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC: reads localStorage synchronously before first paint to avoid theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('velox-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
        <Toaster
          position="bottom-right"
          theme="system"
          richColors={false}
          closeButton
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              borderRadius: "var(--radius)",
              fontSize: "13px",
            },
            classNames: {
              success: "!border-profit/40",
              error: "!border-loss/40",
              info: "!border-ring/40",
            },
          }}
        />
      </body>
    </html>
  );
}
