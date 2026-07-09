import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://parametric.iverfinne.no'),
  title: 'Candle Holder Builder — iverfinne.no',
  description:
    'A parametric builder for organic candle stick holders — symmetries, booleans and lattices meshed into printable ceramic-like forms.',
  openGraph: {
    title: 'Candle Holder Builder',
    description:
      'A parametric builder for organic candle stick holders — symmetries, booleans and lattices meshed into printable ceramic-like forms.',
    url: 'https://parametric.iverfinne.no',
    siteName: 'Candle Holder Builder',
    images: [{ url: '/og.png', width: 1300, height: 630, alt: 'A glossy white ruffled ceramic tealight holder on black' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Candle Holder Builder',
    description:
      'Parametric organic candle holders — symmetries, booleans and lattices.',
    images: ['/og.png'],
  },
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Candle Holder Builder',
  },
  applicationName: 'Candle Holder Builder',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="overflow-hidden antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
