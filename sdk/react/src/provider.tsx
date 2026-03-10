import type { SiloClient } from "@silo/sdk-core";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const SiloClientContext = createContext<SiloClient | null>(null);

export interface SiloClientProviderProps {
  client: SiloClient;
  children: ReactNode;
}

export function SiloClientProvider({
  client,
  children,
}: SiloClientProviderProps) {
  return (
    <SiloClientContext.Provider value={client}>
      {children}
    </SiloClientContext.Provider>
  );
}

export function useSiloClient(): SiloClient {
  const client = useContext(SiloClientContext);

  if (!client) {
    throw new Error(
      "useSiloClient must be used within a SiloClientProvider",
    );
  }

  return client;
}
