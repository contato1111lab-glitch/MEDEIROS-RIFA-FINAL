import React from 'react';
import { Menu, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-brand-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link 
          to="/"
          className="flex items-center gap-2 group"
        >
          <BrandLogo className="font-black text-xl md:text-2xl tracking-tighter" />
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            to="/meus-bilhetes"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-brand-border text-white transition-all hover:border-brand-primary hover:text-brand-primary text-xs md:text-sm font-bold uppercase tracking-wider"
          >
            <Ticket size={16} />
            <span className="hidden sm:inline">Meus Bilhetes</span>
          </Link>

          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-brand-border text-white transition-all hover:border-brand-primary hover:text-brand-primary"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
};
