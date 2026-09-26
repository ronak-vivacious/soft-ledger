import { useCallback, useEffect, useState } from "react";
import { fetchMe, signOut as apiSignOut } from "@/lib/api-client";

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  username?: string | null;
  role?: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isAuthenticated = !isLoading && !!user;

  return {
    isLoading,
    isAuthenticated,
    user,
    refresh,
    signOut: apiSignOut,
  };
}
