export interface NFT {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  marketplace: string;
  collection_name: string;
  creator_address: string;
  owner_address: string;
  price?: {
    amount: number;
    currency: string;
  };
  token_properties?: Record<string, string>;
  last_sold_at?: string;
  created_at: string;
  // Optional fields for listings and details
  listing_id?: string;
  supply?: string;
  maximum?: string;
  token_uri?: string;
  collection_id?: string;
  metadata_uri?: string;
  
  // Details for expanded view
  image?: string;
  lastPrice?: { amount: number; currency: string; };
  collection?: string;
  owner?: string;
  tokenName?: string;
  tokenDataId?: string;
  collectionName?: string;
  createdAt?: string;
  
  // Flag for whether the NFT has complete metadata
  hasCompleteMetadata?: boolean;
}

export interface MarketplaceConfig {
  id: string;
  name: string;
  logo_url: string;
  website_url: string;
  is_connected: boolean;
  supported_chains: string[];
  api_key?: string;
  last_synced_at?: string;
  rawValues?: string;  // Comma-separated list of actual marketplace IDs
}

export interface AggregatorStats {
  total_nfts?: number;
  total_collections?: number;
  total_marketplaces: number;
  total_value_usd?: number;
  total_active_listings?: number;
  marketplace_distribution: Record<string, number>;
} 