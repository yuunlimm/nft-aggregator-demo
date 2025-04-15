import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { Buffer } from 'buffer';
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { BrowserRouter } from "react-router-dom";
import {
    AptosWalletAdapterProvider,
    NetworkName,
    useWallet,
  } from "@aptos-labs/wallet-adapter-react";

// Set Buffer for proper wallet functionality
// @ts-ignore: Buffer is used by wallet adapters
window.Buffer = Buffer;

// Create Petra wallet adapter only
export const walletAdapters = [
  new PetraWallet()
];

// Set up React app with wallet provider
const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <AptosWalletAdapterProvider 
      plugins={walletAdapters as any} // Type casting to bypass type checking issues
      autoConnect={false} 
      onError={(error) => {
        // Silent error handling to prevent console logs
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AptosWalletAdapterProvider>
  </React.StrictMode>
); 