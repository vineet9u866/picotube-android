"use client";

import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";

interface UseInfiniteScrollOptions {
  /** Called when the sentinel enters the viewport. */
  onLoadMore: () => void;
  /** Disable further triggers (e.g. while a request is in-flight, or no more pages). */
  hasMore: boolean;
  /** Disable triggers when this is true (e.g. initial load). */
  isLoading?: boolean;
  /** Distance from the viewport at which to fire, in px. Default 400. */
  rootMargin?: number;
  /** Whether to actually observe. Set false to pause. */
  enabled?: boolean;
}

/**
 * IntersectionObserver-based infinite scroll hook.
 *
 * Returns a `ref` callback to attach to a sentinel element placed at the
 * bottom of a list. When that sentinel scrolls within `rootMargin` pixels
 * of the viewport, `onLoadMore` fires — but only if `hasMore` is true and
 * we're not already loading.
 *
 * Uses a callback ref so the IntersectionObserver is set up as soon as the
 * sentinel DOM node is mounted (not on the next effect tick).
 *
 * The IntersectionObserver only fires on intersection *transitions*, so we
 * also re-check after every load: if the sentinel is still in view (because
 * the new page didn't add enough height to push it out), we fire again.
 * This handles short pages where the initial content doesn't fill the
 * viewport and we need to load multiple pages back-to-back.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  onLoadMore,
  hasMore,
  isLoading = false,
  rootMargin = 400,
  enabled = true,
}: UseInfiniteScrollOptions): RefCallback<T> {
  const nodeRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [triggered, setTriggered] = useState(false);

  // Keep latest values in a ref so the observer callback always sees them.
  const stateRef = useRef({ onLoadMore, hasMore, isLoading, enabled, triggered });
  stateRef.current = { onLoadMore, hasMore, isLoading, enabled, triggered };

  // Helper: check if the sentinel is currently within `rootMargin` of the
  // viewport, and if so, fire onLoadMore (if not already triggered).
  const maybeFire = useCallback(() => {
    const s = stateRef.current;
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight + rootMargin;
    if (!s.enabled || !s.hasMore || s.isLoading || s.triggered) return;
    if (inView) {
      setTriggered(true);
      s.onLoadMore();
    }
  }, [rootMargin]);

  // Re-evaluate after every load completes: if the sentinel is still in view
  // (short page), fire again. Also covers the initial-mount case where the
  // sentinel is already visible before any scrolling happens.
  useEffect(() => {
    if (!isLoading) {
      setTriggered(false);
      // Defer to next tick so the new content has rendered and the sentinel
      // position reflects the new page.
      const t = setTimeout(maybeFire, 50);
      return () => clearTimeout(t);
    }
  }, [isLoading, hasMore, enabled, maybeFire]);

  // Callback ref — fires when the sentinel DOM node mounts/unmounts.
  // We set up the IntersectionObserver here (not in a useEffect) so it's
  // attached as soon as the node exists.
  const refCallback: RefCallback<T> = useCallback(
    (node) => {
      // Tear down any previous observer.
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      nodeRef.current = node;
      if (!node) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            maybeFire();
          }
        },
        {
          root: null,
          rootMargin: `${rootMargin}px`,
          threshold: 0,
        },
      );
      observer.observe(node);
      observerRef.current = observer;

      // Also fire once immediately in case the sentinel is already in view
      // at mount time (e.g. short first page).
      maybeFire();
    },
    [maybeFire, rootMargin],
  );

  return refCallback;
}
