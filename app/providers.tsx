"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Client-side providers wrapper for the application.
 *
 * QueryClient is created once per component lifecycle via useState
 * to prevent sharing cache state across SSR requests.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 60 * 1000, // 60 minutes — data updates once per day
            gcTime: 2 * 60 * 60 * 1000, // 120 minutes
            refetchOnWindowFocus: false, // large datasets — no auto refetch on focus
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
