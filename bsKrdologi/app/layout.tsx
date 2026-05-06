import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'LOGINEX | Logistics Intelligence',
  description: 'Fully-featured logistics intelligence platform for Pakistan\'s e-commerce industry',
};

import LanguageProvider from '@/components/providers/LanguageProvider';
import LoadingWrapper from '@/components/providers/LoadingWrapper';
import CartIcon from '@/components/ecommerce/CartIcon';
import CartDrawer from '@/components/ecommerce/CartDrawer';
import PaymentModal from '@/components/PaymentModal';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased text-slate-900 min-h-screen flex flex-col" suppressHydrationWarning>
        <LanguageProvider>
          <LoadingWrapper>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </LoadingWrapper>
          <Suspense fallback={null}>
            <CartIcon />
            <CartDrawer />
            <PaymentModal />
          </Suspense>
        </LanguageProvider>
      </body>
    </html>
  );
}
