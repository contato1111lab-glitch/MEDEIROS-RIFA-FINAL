import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { metaPixelService } from '../services/metaPixelService';
import { supabase } from '../services/supabaseClient';

export const MetaPixelManager: React.FC = () => {
  const location = useLocation();
  const [pixelsLoaded, setPixelsLoaded] = useState(false);

  // 1. Fetch active pixels and initialize on mount
  useEffect(() => {
    let mounted = true;

    async function loadPixels() {
      try {
        const { data, error } = await supabase
          .from('meta_pixels')
          .select('pixel_id')
          .eq('is_active', true);
          
        if (error) {
          console.error('Failed to load Meta Pixels:', error);
          return;
        }

        if (mounted && data && data.length > 0) {
          const pixelIds = data.map(p => p.pixel_id);
          metaPixelService.init(pixelIds);
          setPixelsLoaded(true);
        }
      } catch (err) {
        console.error('Error loading Meta Pixels:', err);
      }
    }

    loadPixels();

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Track PageView on route change (but wait until pixels are loaded)
  useEffect(() => {
    if (pixelsLoaded) {
      // Small timeout ensures the page actually finished rendering for the view
      const timer = setTimeout(() => {
        metaPixelService.track('PageView');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, pixelsLoaded]);

  // Headless component
  return null;
};
