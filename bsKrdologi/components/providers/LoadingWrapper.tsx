'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LoadingScreen } from '../LoadingScreen';

export default function LoadingWrapper({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  return (
    <>
      {/*
        IMPORTANT: children must ALWAYS be in the React tree so the Next.js
        layout router is mounted. Hiding them via CSS opacity while the loader
        is visible keeps router context alive and prevents the invariant crash.
      */}
      <div
        className="flex-1 flex flex-col"
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      >
        {children}
      </div>

      {/* Overlay loader on top — AnimatePresence handles the fade-out */}
      <AnimatePresence>
        {isLoading && (
          <LoadingScreen key="loading" onComplete={handleLoadingComplete} />
        )}
      </AnimatePresence>
    </>
  );
}
