import { QueryClient } from '@tanstack/react-query';
import { SessionExpiredError } from '@/lib/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof SessionExpiredError) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** Drop cached API data when the active park / session context changes. */
export function clearTenantCache() {
  queryClient.cancelQueries();
  queryClient.clear();
}
