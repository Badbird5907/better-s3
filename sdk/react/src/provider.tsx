import type { BetterS3Client } from "@silo/sdk-core";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const BetterS3ClientContext = createContext<BetterS3Client | null>(null);

export interface BetterS3ClientProviderProps {
  client: BetterS3Client;
  children: ReactNode;
}

export function BetterS3ClientProvider({
  client,
  children,
}: BetterS3ClientProviderProps) {
  return (
    <BetterS3ClientContext.Provider value={client}>
      {children}
    </BetterS3ClientContext.Provider>
  );
}

export function useBetterS3Client(): BetterS3Client {
  const client = useContext(BetterS3ClientContext);

  if (!client) {
    throw new Error(
      "useBetterS3Client must be used within a BetterS3ClientProvider",
    );
  }

  return client;
}
