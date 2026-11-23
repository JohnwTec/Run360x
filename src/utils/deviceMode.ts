import { useEffect, useState } from 'react';

export type DevicePreference = 'auto' | 'smartwatch' | 'smartphone' | 'tablet' | 'desktop';
export type ResolvedDevice = 'smartwatch' | 'smartphone' | 'tablet' | 'desktop';

const STORAGE_KEY = 'run360x_device_preference_v1';

export function detectDeviceFromViewport(width: number): ResolvedDevice {
  if (width <= 320) return 'smartwatch';
  if (width <= 767) return 'smartphone';
  if (width <= 1180) return 'tablet';
  return 'desktop';
}

export function getDeviceLabel(device: DevicePreference): string {
  switch (device) {
    case 'auto':
      return 'Auto';
    case 'smartwatch':
      return 'Smartwatch';
    case 'smartphone':
      return 'Smartphone';
    case 'tablet':
      return 'Tablet';
    case 'desktop':
      return 'Computador';
  }
}

export function useDeviceMode() {
  const [preference, setPreferenceState] = useState<DevicePreference>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = window.localStorage.getItem(STORAGE_KEY) as DevicePreference | null;
    if (saved && ['auto', 'smartwatch', 'smartphone', 'tablet', 'desktop'].includes(saved)) {
      return saved;
    }
    return 'auto';
  });

  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setPreference = (next: DevicePreference) => {
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const detectedDevice: ResolvedDevice = detectDeviceFromViewport(viewportWidth);
  const activeDevice: ResolvedDevice = preference === 'auto' ? detectedDevice : preference;
  const isManualOverride = preference !== 'auto';

  return {
    preference,
    setPreference,
    detectedDevice,
    activeDevice,
    isManualOverride,
    viewportWidth,
  };
}
