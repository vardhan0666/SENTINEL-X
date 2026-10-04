/**
 * Sentinel-X — usePagination Hook
 *
 * Provides reusable pagination state and helpers compatible with the
 * existing backend pagination response format:
 *
 *   {
 *     items: T[];
 *     total: number;
 *     page: number;
 *     size: number;
 *     pages: number;
 *   }
 *
 * Also supports flat array responses (non-paginated) for endpoints that
 * return a plain list.
 *
 * Usage:
 *   const pagination = usePagination({ initialPage: 1, initialSize: 25 });
 *
 *   // In a useEffect:
 *   const result = await listEvents({ page: pagination.page, size: pagination.size });
 *   pagination.setResponse(result);
 *
 *   // In JSX:
 *   <button onClick={pagination.prevPage} disabled={!pagination.hasPrev}>Prev</button>
 *   <button onClick={pagination.nextPage} disabled={!pagination.hasNext}>Next</button>
 */

import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Backend paginated response shape
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface UsePaginationOptions {
  initialPage?: number;
  initialSize?: number;
}

// ---------------------------------------------------------------------------
// Hook return value
// ---------------------------------------------------------------------------

export interface UsePaginationReturn<T> {
  /** Current items for the active page */
  items: T[];
  /** Current page number (1-indexed) */
  page: number;
  /** Page size */
  size: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages */
  pages: number;
  /** Whether a previous page is available */
  hasPrev: boolean;
  /** Whether a next page is available */
  hasNext: boolean;
  /** Navigate to the next page */
  nextPage: () => void;
  /** Navigate to the previous page */
  prevPage: () => void;
  /** Jump to a specific page (1-indexed) */
  goToPage: (page: number) => void;
  /** Change the page size and reset to page 1 */
  setSize: (size: number) => void;
  /**
   * Feed a backend response into the pagination state.
   * Accepts either a PaginatedResponse<T> or a raw T[] (flat list).
   */
  setResponse: (response: PaginatedResponse<T> | T[]) => void;
  /** Reset pagination state to initial values */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePagination<T>(
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { initialPage = 1, initialSize = 25 } = options;

  const [page, setPage] = useState<number>(initialPage);
  const [size, setPageSize] = useState<number>(initialSize);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [pages, setPages] = useState<number>(0);

  const hasPrev = page > 1;
  const hasNext = page < pages;

  const nextPage = useCallback(() => {
    if (hasNext) {
      setPage((p) => p + 1);
    }
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) {
      setPage((p) => p - 1);
    }
  }, [hasPrev]);

  const goToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(targetPage, pages || 1));
      setPage(clamped);
    },
    [pages]
  );

  const setSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page when size changes
  }, []);

  const setResponse = useCallback(
    (response: PaginatedResponse<T> | T[]) => {
      if (Array.isArray(response)) {
        // Flat list response — treat entire list as single page
        setItems(response);
        setTotal(response.length);
        setPages(1);
        // Keep current page as-is (page 1 for flat responses)
      } else {
        // Paginated response from backend
        setItems(response.items);
        setTotal(response.total);
        setPages(response.pages);
        // Sync page from response in case backend clamps it
        if (response.page !== page) {
          setPage(response.page);
        }
      }
    },
    [page]
  );

  const reset = useCallback(() => {
    setPage(initialPage);
    setPageSize(initialSize);
    setItems([]);
    setTotal(0);
    setPages(0);
  }, [initialPage, initialSize]);

  return {
    items,
    page,
    size,
    total,
    pages,
    hasPrev,
    hasNext,
    nextPage,
    prevPage,
    goToPage,
    setSize,
    setResponse,
    reset,
  };
}

export default usePagination;