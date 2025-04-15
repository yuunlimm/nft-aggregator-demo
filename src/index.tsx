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
window.Buffer = Buffer;

// Create Aptos wallet adapters - Automatically detects supported wallets
// Add or remove wallets based on what's detected in your environment
console.log("Initializing wallet adapters...");

// Create the wallet adapters
// Export the array so it can be used in other components
export const walletAdapters = [
  new PetraWallet(),
];

console.log(`Created ${walletAdapters.length} wallet adapters`);

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <AptosWalletAdapterProvider 
      plugins={walletAdapters} 
      autoConnect={true}
      onError={(error) => {
        console.error('Wallet adapter error:', error);
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AptosWalletAdapterProvider>
  </React.StrictMode>
); 