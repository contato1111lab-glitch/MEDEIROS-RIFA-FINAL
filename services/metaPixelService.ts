//@ts-nocheck
export class MetaPixelService {
  private initialized = false;
  private trackedEvents = new Set<string>();

  /**
   * Initializes Facebook Pixel with all active pixels from the database.
   */
  public init(pixels: string[]) {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;
    if (!pixels || pixels.length === 0) return;

    // Standard Facebook Pixel snippet
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

    // Initialize all active pixels
    pixels.forEach(pixelId => {
      window.fbq('init', pixelId);
    });

    this.initialized = true;
  }

  /**
   * Track an event, ensuring idempotency if eventId is provided.
   */
  public track(eventName: string, data?: any, eventId?: string) {
    if (!this.initialized || typeof window === 'undefined' || !window.fbq) return;

    // Deduplication mechanism
    if (eventId) {
      const uniqueKey = `${eventName}_${eventId}`;
      if (this.trackedEvents.has(uniqueKey)) {
        return; // Already tracked
      }
      this.trackedEvents.add(uniqueKey);
      window.fbq('track', eventName, data, { eventID: eventId });
    } else {
      // Without eventId, rely on basic tracking
      window.fbq('track', eventName, data);
    }
  }

  /**
   * Track Custom event, ensuring idempotency if eventId is provided.
   */
  public trackCustom(eventName: string, data?: any, eventId?: string) {
    if (!this.initialized || typeof window === 'undefined' || !window.fbq) return;

    // Deduplication mechanism
    if (eventId) {
      const uniqueKey = `${eventName}_${eventId}`;
      if (this.trackedEvents.has(uniqueKey)) {
        return; 
      }
      this.trackedEvents.add(uniqueKey);
      window.fbq('trackCustom', eventName, data, { eventID: eventId });
    } else {
      window.fbq('trackCustom', eventName, data);
    }
  }
}

export const metaPixelService = new MetaPixelService();

// Add type for window.fbq
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}
