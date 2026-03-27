import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  apiKey: string;
  setApiKey: (key: string) => void;
};

const DebriefApiKeyContext = createContext<Ctx | null>(null);

export function DebriefApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key.trim());
  }, []);

  const value = useMemo(() => ({ apiKey, setApiKey }), [apiKey, setApiKey]);

  return (
    <DebriefApiKeyContext.Provider value={value}>{children}</DebriefApiKeyContext.Provider>
  );
}

export function useDebriefApiKey(): Ctx {
  const ctx = useContext(DebriefApiKeyContext);
  if (!ctx) {
    throw new Error("useDebriefApiKey must be used within DebriefApiKeyProvider");
  }
  return ctx;
}
