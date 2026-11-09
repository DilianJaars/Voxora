'use client';
import { useEffect } from 'react';
import { getSettings } from '@/lib/store';

export default function ThemeSync() {
  useEffect(() => {
    const apply = () => {
      const s = getSettings();
      document.documentElement.classList.toggle('light', s.theme === 'light');
      document.documentElement.classList.toggle('dark', s.theme === 'dark');
    };
    apply();
    window.addEventListener('voxora:settings', apply);
    return () => window.removeEventListener('voxora:settings', apply);
  }, []);
  return null;
}
