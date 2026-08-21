import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile } from '../types';
import { raffleService } from '../services/raffleService';

interface CustomerContextType {
  customer: Profile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  authModalMode: 'login' | 'register';
  login: (identifier: string, password?: string) => Promise<Profile>;
  register: (data: Partial<Profile>) => Promise<Profile>;
  logout: () => void;
  refreshCustomer: () => Promise<void>;
  updateCustomerProfile: (updates: Partial<Profile>) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const refreshCustomer = async () => {
    try {
      const session = raffleService.getCurrentCustomerSession();
      if (session && session.id) {
        setCustomer(session);
      } else {
        setCustomer(null);
      }
    } catch (e) {
      console.error('Error refreshing customer session:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCustomer();
  }, []);

  const login = async (identifier: string, password?: string): Promise<Profile> => {
    const prof = await raffleService.loginCustomer(identifier, password);
    setCustomer(prof);
    setIsAuthModalOpen(false);
    return prof;
  };

  const register = async (data: Partial<Profile>): Promise<Profile> => {
    const prof = await raffleService.createProfile(data);
    setCustomer(prof);
    setIsAuthModalOpen(false);
    return prof;
  };

  const logout = () => {
    raffleService.setCustomerSession(null);
    setCustomer(null);
  };

  const updateCustomerProfile = async (updates: Partial<Profile>) => {
    if (!customer?.id) return;
    await raffleService.updateProfile(customer.id, updates);
    await refreshCustomer();
  };

  return (
    <CustomerContext.Provider
      value={{
        customer,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode,
        login,
        register,
        logout,
        refreshCustomer,
        updateCustomerProfile
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerProvider');
  }
  return context;
};
