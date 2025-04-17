import { AptosClient } from './AptosClient';
import { NFTService } from './NFTService';

/**
 * This file provides configured instances of our API client classes.
 * It serves as the entry point for API access throughout the application.
 */

// Default API key can be loaded from environment variables
// Using import.meta.env for Vite projects instead of process.env
const DEFAULT_API_KEY = import.meta.env.VITE_APTOS_API_KEY || '';

// Create a singleton instance of AptosClient with API key
export const aptosClient = new AptosClient(DEFAULT_API_KEY);

// Create a singleton instance of NFTService that uses our client
export const nftService = new NFTService(aptosClient);

/**
 * Update the API key for all services
 * @param apiKey - The new API key to use
 */
export function updateApiKey(apiKey: string): void {
  // Create new instances with the updated API key
  const newClient = new AptosClient(apiKey);
  
  // Replace the exported objects with new instances
  Object.assign(aptosClient, newClient);
  Object.assign(nftService, new NFTService(newClient));
  
  console.log('API key updated for all services');
}

// Direct exports from nftService to maintain compatibility with the original api.ts
export const fetchActiveListings = (params?: any) => nftService.fetchActiveListings(params);
export const formatMarketplaceName = (marketplace: string): string => nftService.formatMarketplaceName(marketplace);
export const convertIPFSUrl = (url: string): string => nftService.convertIpfsUrl(url);
export const fetchNFTDetails = (nftId: string) => nftService.fetchNFTDetails(nftId);
export const formatAPTAmount = (octas: string | number): number => nftService.formatAPTAmount(octas);
export const fetchCollectionsByVolume = (params?: any) => nftService.fetchCollectionsByVolume(params);
export const fetchCollectionsBySales = (params?: any) => nftService.fetchCollectionsBySales(params);
export const fetchCollectionsByFloorPrice = (params?: any) => nftService.fetchCollectionsByFloorPrice(params);
export const invalidateListingsCache = (specificParams?: any): void => nftService.invalidateListingsCache(specificParams); 