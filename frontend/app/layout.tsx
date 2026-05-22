import type { Metadata, Viewport } from 'next'
import './globals.css'
import PWAProvider from '@/components/PWAProvider'
import { ToastProvider } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/components/shared/Toast'
import { OfflineBanner } from '@/components/shared/OfflineBanner'

export const metadata: Metadata = {
  title: 'Road Safety AI v21 — BIMSTEC 2026 | Team Bro Code, VIT Bhopal',
  description: 'AI-powered road safety assistant for BIMSTEC nations. Know your rights, report road issues, get emergency help instantly.',
  keywords: ['road safety', 'AI', 'traffic fines', 'emergency', 'BIMSTEC', 'Team Bro Code', 'VIT', 'challan'],
  authors: [{ name: 'Road Safety AI Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Road Safety AI',
  },
  openGraph: {
    title: 'Road Safety AI',
    description: 'AI That Saves Lives on Indian & BIMSTEC Roads',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FF6200',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Google Fonts — graceful degradation when offline */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* PWA / iOS */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Road Safety AI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#FF6200" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className="font-body bg-brand-blue text-white antialiased">
        <ToastProvider>
          <PWAProvider>
            {/*
              OfflineBanner sits fixed at top: 56px (below Navbar).
              When online with 0 pending reports it renders nothing.
              When offline/slow it slides down with an amber/blue bar.
              When reports sync it briefly shows a green success bar.
            */}
            <OfflineBanner />
            {children}
          </PWAProvider>
          {/* Custom toast renderer — supports 'emergency' variant (8 s, red pulse) */}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  )
}
