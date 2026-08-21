import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';
import { raffleService } from '../services/raffleService';
import { WHITE_LABEL_CONFIG } from '../white-label';

interface ThemeContextType {
  brandPrimary: string;
  brandSecondary: string;
  siteTheme: string;
  siteMode: string;
  isInitialized: boolean;
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  brandPrimary: WHITE_LABEL_CONFIG.brandPrimary,
  brandSecondary: WHITE_LABEL_CONFIG.brandSecondary,
  siteTheme: WHITE_LABEL_CONFIG.theme,
  siteMode: WHITE_LABEL_CONFIG.mode,
  isInitialized: false,
  refreshTheme: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

const themePalette: Record<string, { primary: string, dark: string, light: string }> = {
  azure: { primary: '#3b82f6', dark: '#2563eb', light: '#60a5fa' },     // blue-500, blue-600, blue-400
  emerald: { primary: '#10b981', dark: '#059669', light: '#34d399' },   // emerald-500, emerald-600, emerald-400
  ruby: { primary: '#ef4444', dark: '#dc2626', light: '#f87171' },      // red-500, red-600, red-400
  amethyst: { primary: '#8b5cf6', dark: '#7c3aed', light: '#a78bfa' },  // violet-500, violet-600, violet-400
  gold: { primary: '#eab308', dark: '#ca8a04', light: '#facc15' },      // yellow-500, yellow-600, yellow-400
  onyx: { primary: '#ffffff', dark: '#d4d4d8', light: '#ffffff' },      // white, zinc-300, white
};

const applyThemeVariables = (theme: string, mode: string) => {
  if (typeof document === 'undefined') return;
  if (mode === 'light') {
    document.documentElement.classList.add('light-mode');
  } else {
    document.documentElement.classList.remove('light-mode');
  }
  
  const palette = themePalette[theme] || themePalette['azure'];
  
  document.documentElement.style.setProperty('--theme-color-primary', palette.primary);
  document.documentElement.style.setProperty('--theme-color-dark', palette.dark);
  document.documentElement.style.setProperty('--theme-color-light', palette.light);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandPrimary, setBrandPrimary] = useState(WHITE_LABEL_CONFIG.brandPrimary);
  const [brandSecondary, setBrandSecondary] = useState(WHITE_LABEL_CONFIG.brandSecondary);
  const [siteTheme, setSiteTheme] = useState(WHITE_LABEL_CONFIG.theme);
  const [siteMode, setSiteMode] = useState(WHITE_LABEL_CONFIG.mode);
  const [isInitialized, setIsInitialized] = useState(false);

  // Apply statically defined theme immediately on first render layout phase
  useLayoutEffect(() => {
    applyThemeVariables(WHITE_LABEL_CONFIG.theme, WHITE_LABEL_CONFIG.mode);
  }, []);

  const loadTheme = async () => {
    try {
      const settings = await raffleService.getSiteSettings();
      const newPrimary = settings.brandPrimary || WHITE_LABEL_CONFIG.brandPrimary;
      const newSecondary = settings.brandSecondary !== undefined ? settings.brandSecondary : WHITE_LABEL_CONFIG.brandSecondary;
      const newTheme = settings.siteTheme || WHITE_LABEL_CONFIG.theme;
      const newMode = settings.siteMode || WHITE_LABEL_CONFIG.mode;
      
      setBrandPrimary(newPrimary);
      setBrandSecondary(newSecondary);
      setSiteTheme(newTheme);
      setSiteMode(newMode);

      applyThemeVariables(newTheme, newMode);
    } catch (e) {
      console.warn("Could not load theme settings", e);
    } finally {
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  return (
    <ThemeContext.Provider value={{ brandPrimary, brandSecondary, siteTheme, siteMode, isInitialized, refreshTheme: loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
