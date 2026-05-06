'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Noto_Sans_Arabic } from 'next/font/google';

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-ur',
});

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { language } = useAppStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    // Update HTML dir attribute
    const dir = language === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, isMounted]);

  const urduClasses = isMounted && language === 'ur' ? `${notoArabic.variable} font-ur` : '';

  return (
    <div className={`${urduClasses} min-h-screen flex flex-col`}>
      {children}
    </div>
  );
}
