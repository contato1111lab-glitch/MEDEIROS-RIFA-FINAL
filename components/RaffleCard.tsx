import React from 'react';
import { Raffle, RaffleStatus } from '../types';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

interface RaffleCardProps {
  raffle: Raffle;
  onClick: (raffle: Raffle) => void;
  variant?: 'featured' | 'list' | 'grid';
}

export const RaffleCard: React.FC<RaffleCardProps> = ({ raffle, onClick, variant = 'grid' }) => {
  const isFinished = raffle.status === RaffleStatus.FINISHED;
  const buttonText = isFinished ? 'VER RESULTADO' : 'QUERO PARTICIPAR';
  const priceFormatted = raffle.pricePerNumber.toFixed(2).replace('.', ',');

  if (variant === 'featured') {
    return (
      <div 
        onClick={() => onClick(raffle)}
        className="group relative bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden cursor-pointer transition-all hover:border-brand-primary/50 shadow-2xl protected-card"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div 
          className="w-full aspect-auto md:aspect-auto relative overflow-hidden bg-zinc-950 protected-img-bg bg-cover bg-center"
          style={{ backgroundImage: `url("${raffle.imageUrl}")` }}
          data-protected-image
        >
          <img 
            src={imageSrc(raffle.imageUrl)} onError={handleImageError} 
            alt={raffle.name} 
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className="w-full h-auto opacity-0 pointer-events-none select-none block" 
          />

          {/* Efeito Netflix: degradê suave de preto para transparente na base da imagem */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent pt-12 md:pt-16 pb-4 sm:pb-6 px-4 sm:px-6 md:px-8 flex items-end justify-between gap-3 sm:gap-4 pointer-events-auto">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-lg sm:text-2xl md:text-3xl font-black text-[#ffffff] uppercase tracking-tight leading-tight line-clamp-1 drop-shadow-md">
                {raffle.name}
              </h3>
              <p className="text-zinc-300 text-xs sm:text-sm md:text-base font-bold uppercase tracking-wide mt-0.5 sm:mt-1 drop-shadow-md">
                Por apenas <span className="text-brand-primary-light font-black">R$ {priceFormatted}</span> por cota
              </p>
            </div>

            <div className="flex-shrink-0 w-[45%] sm:w-auto">
              <button className="w-full bg-brand-primary hover:bg-brand-primary-light text-black font-black uppercase tracking-wider text-xs sm:text-sm md:text-base px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-brand-primary/20 text-center whitespace-nowrap">
                {buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div 
        onClick={() => onClick(raffle)}
        className="group relative bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden cursor-pointer transition-all hover:border-brand-primary/50 shadow-xl protected-card"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div 
          className="w-full aspect-auto sm:aspect-auto relative overflow-hidden bg-zinc-950 protected-img-bg bg-cover bg-center"
          style={{ backgroundImage: `url("${raffle.imageUrl}")` }}
          data-protected-image
        >
          <img 
            src={imageSrc(raffle.imageUrl)} onError={handleImageError} 
            alt={raffle.name} 
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className="w-full h-auto opacity-0 pointer-events-none select-none block" 
          />

          {/* Efeito Netflix: degradê discreto na base da imagem */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent pt-10 pb-3.5 px-3.5 sm:px-5 flex items-end justify-between gap-2.5 pointer-events-auto">
            <div className="flex-1 min-w-0 pr-1">
              <h3 className="text-base sm:text-lg md:text-xl font-black text-[#ffffff] uppercase tracking-tight leading-tight line-clamp-1 drop-shadow-md">
                {raffle.name}
              </h3>
              <p className="text-zinc-300 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 drop-shadow-md">
                Por apenas <span className="text-brand-primary-light font-black">R$ {priceFormatted}</span> por cota
              </p>
            </div>

            <div className="flex-shrink-0 w-[45%] sm:w-auto">
              <button className="w-full bg-brand-primary hover:bg-brand-primary-light text-black font-black uppercase tracking-wider text-[11px] sm:text-xs py-2.5 px-3 sm:px-5 rounded-xl transition-all shadow-md shadow-brand-primary/10 text-center whitespace-nowrap">
                {buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => onClick(raffle)}
      className="group relative bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-brand-primary/50 shadow-lg protected-card"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        className="w-full aspect-auto relative overflow-hidden bg-zinc-950 protected-img-bg bg-cover bg-center"
        style={{ backgroundImage: `url("${raffle.imageUrl}")` }}
        data-protected-image
      >
        <img 
          src={imageSrc(raffle.imageUrl)} onError={handleImageError} 
          alt={raffle.name} 
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          className="w-full h-auto opacity-0 pointer-events-none select-none block" 
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent pt-10 pb-3 px-4 flex items-end justify-between gap-3 pointer-events-auto">
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="text-sm sm:text-base font-black text-[#ffffff] uppercase tracking-tight leading-tight line-clamp-1 drop-shadow-md">
              {raffle.name}
            </h3>
            <p className="text-zinc-300 text-[10px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 drop-shadow-md">
              Por apenas <span className="text-brand-primary-light font-black">R$ {priceFormatted}</span> por cota
            </p>
          </div>

          <div className="flex-shrink-0 w-[45%] sm:w-auto">
            <button className="w-full bg-brand-primary hover:bg-brand-primary-light text-black font-black uppercase tracking-wider text-[10px] sm:text-xs py-2 px-3 sm:px-4 rounded-xl transition-all shadow-md text-center whitespace-nowrap">
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


