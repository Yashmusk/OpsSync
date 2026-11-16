import { createContext } from "react";

// Shared login state: { user, company, isLoggedIn, checking, signIn, signOut }
export const AuthContext = createContext(null);
