import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { raffleService } from '../services/raffleService';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

export const HeroCarousel: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBanners = async () => {
        try {
            const fetched = await raffleService.getBanners();
            setImages(fetched.map((b: any) => b.image_url));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadBanners();
  }, []);

  useEffect(() => {
    // Only auto-play if there is more than one image
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images]);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  // If loading, show placeholder (subtle)
  if (loading) return <div className="w-full aspect-auto md:aspect-auto lg:aspect-auto xl:aspect-auto animate-pulse bg-zinc-900/50 rounded-xl" />;
  
  // If loaded and no images, return nothing (remove from DOM)
  if (images.length === 0) return null;

  return (
    <div className="relative w-full aspect-auto md:aspect-auto lg:aspect-auto xl:aspect-auto overflow-hidden group rounded-xl">
      
      {/* Images */}
      {images.length > 0 && <img src={imageSrc(images[0])} className="w-full h-auto invisible pointer-events-none block" alt="" />}

      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out protected-img-bg bg-cover bg-center sm:bg-center ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url("${imageSrc(img)}")` }}
          data-protected-image
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {/* Transparent overlay preventing dragging or image menu */}
          <div className="absolute inset-0 z-10 select-none pointer-events-none" />
          <img 
            src={imageSrc(img)}
            onError={handleImageError}
            alt="Banner Promocional"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            className="w-full h-full object-cover opacity-0 pointer-events-none select-none" 
          />
        </div>
      ))}

      {/* Controls - Only show if more than 1 image */}
      {images.length > 1 && (
        <>
            <button 
                onClick={prevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 hover:bg-zinc-800/50 rounded-full text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 duration-300"
            >
                <ChevronLeft size={24} />
            </button>
            <button 
                onClick={nextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 hover:bg-zinc-800/50 rounded-full text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 duration-300"
            >
                <ChevronRight size={24} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                {images.map((_, idx) => (
                <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all shadow-sm ${
                    idx === currentIndex ? 'bg-brand-primary w-6' : 'bg-white/20 hover:bg-white/50 w-1.5'
                    }`}
                />
                ))}
            </div>
        </>
      )}
    </div>
  );
};