import { useEffect, useRef } from 'react';

interface MenuColors {
  primaryColor?: string | null;
  accentColor?: string | null;
}

export function useMenuColors({ primaryColor, accentColor }: MenuColors) {
  const appliedRef = useRef(false);

  useEffect(() => {
    // Aplicar cores apenas uma vez quando disponíveis
    if (!appliedRef.current && (primaryColor || accentColor)) {
      if (primaryColor) {
        document.documentElement.style.setProperty('--public-primary', primaryColor);
      }
      if (accentColor) {
        document.documentElement.style.setProperty('--public-accent', accentColor);
      }
      appliedRef.current = true;
    }

    // Cleanup ao desmontar
    return () => {
      document.documentElement.style.removeProperty('--public-primary');
      document.documentElement.style.removeProperty('--public-accent');
      appliedRef.current = false;
    };
  }, [primaryColor, accentColor]);
}
