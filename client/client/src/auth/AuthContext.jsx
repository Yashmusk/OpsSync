import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, getToken, setToken } from "../api";
import { AuthContext } from "./authContextObject";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, company }
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  // Restore the session from a saved token on first load
  useEffect(() => {
    if (!getToken()) return undefined;
    let active = true;

    apiRequest("/auth/me")
      .then((data) => {
        if (active) setSession({ user: data.user, company: data.company });
      })
      .catch(() => {
        if (active) {
          setToken(null);
          setSession(null);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback((data) => {
    setToken(data.token);
    setSession({ user: data.user, company: data.company });
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setSession(null);
  }, []);

  // Any API call that comes back 401 (expired token, removed from company) logs out
  useEffect(() => {
    const handle = () => signOut();
    window.addEventListener("opssync:unauthorized", handle);
    return () => window.removeEventListener("opssync:unauthorized", handle);
  }, [signOut]);

  const value = useMemo(
    () => ({
      user: session?.user || null,
      company: session?.company || null,
      isLoggedIn: Boolean(session),
      checking,
      signIn,
      signOut,
    }),
    [session, checking, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
