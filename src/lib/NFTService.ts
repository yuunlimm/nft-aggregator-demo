import { NFT, MarketplaceConfig, AggregatorStats, CollectionRankingOptions } from '../types';
import { AptosClient } from './AptosClient';

/**
 * NFTService - A service class for handling NFT-related operations
 * Uses the AptosClient under the hood for API calls
 */
export class NFTService {
  private readonly client: AptosClient;
  private readonly metadataCache: Record<string, any> = {};
  private readonly listingsCache: Record<string, {
    timestamp: number;
    data: { nfts: NFT[]; total: number };
    params: string;
  }> = {};
  private readonly CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Creates a new NFTService
   * @param client - An initialized AptosClient instance
   */
  constructor(client: AptosClient) {
    this.client = client;
  }

  /**
   * Format marketplace name for display purposes
   * @param name - Raw marketplace name
   * @returns Formatted marketplace name
   */
  formatMarketplaceName(name: string): string {
    if (!name) return 'Unknown';
    
    // Special case for Topaz (deprecated)
    if (name.toLowerCase().includes('topaz')) {
      return 'Topaz (Deprecated)';
    }
    
    // Special case for TradePort
    if (name.toLowerCase().includes('tradeport')) {
      return 'TradePort';
    }
    
    // Special case for BluMove
    if (name.toLowerCase().includes('bluemove')) {
      return 'Bluemove';
    }
    
    // Remove common suffixes
    let formattedName = name
      .replace(/_v\d+$/i, '')  // Remove _v1, _v2, etc.
      .replace(/_\d+$/i, '')   // Remove _1, _2, etc.
      .replace(/[-_]/g, ' ');  // Replace hyphens and underscores with spaces
    
    // Capitalize first letter of each word
    formattedName = formattedName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return formattedName;
  }

  /**
   * Get base marketplace name for grouping purposes
   * @param name - Raw marketplace name
   * @returns Base marketplace name
   */
  getBaseMarketplaceName(name: string): string {
    if (!name) return 'unknown';
    
    // Convert to lowercase and remove version suffixes
    return name.toLowerCase()
      .replace(/_v\d+$/i, '')  // Remove _v1, _v2, etc.
      .replace(/_\d+$/i, '')   // Remove _1, _2, etc.
      .replace(/[-_]/g, '');   // Remove hyphens and underscores
  }

  /**
   * Convert IPFS URL to HTTP URL for browser compatibility
   * @param url - IPFS or HTTP URL
   * @returns HTTP URL
   */
  convertIpfsUrl(url: string): string {
    if (!url) return url;
    
    // Check if it's an IPFS URL
    if (url.startsWith('ipfs://')) {
      const ipfsHash = url.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    // It's already an HTTP URL, return as is
    return url;
  }

  /**
   * Get the best available image URL from CDN asset URIs
   * @param cdnAssetUris - CDN asset URIs object
   * @param tokenName - Token name for logging
   * @param token_uri - Optional token URI
   * @returns Best available image URL
   */
  async getBestImageUrl(cdnAssetUris: any, tokenName: string = 'NFT', token_uri?: string): Promise<string> {
    if (!cdnAssetUris) return '';
    
    // First try the CDN image URI if available (second priority)
    if (cdnAssetUris.cdn_image_uri) {
      return cdnAssetUris.cdn_image_uri;
    }
    
    // Then try raw image URI if we didn't already handle it in the special cases
    if (cdnAssetUris.raw_image_uri) {
      // Convert IPFS URL if needed
      const imageUrl = this.convertIpfsUrl(cdnAssetUris.raw_image_uri);
      
      // Check if it's an image or video
      const uri = imageUrl.toLowerCase();
      if (uri.endsWith('.jpg') || uri.endsWith('.jpeg') || uri.endsWith('.png') || 
          uri.endsWith('.gif') || uri.endsWith('.webp') || uri.endsWith('.svg')) {
        return imageUrl;
      }
      
      // For videos and other media, still use it
      if (uri.endsWith('.mp4') || uri.endsWith('.webm') || uri.endsWith('.mov')) {
        return imageUrl;
      }
      
      // If we got here but raw_image_uri doesn't end with a known extension, 
      // we'll still try to use it - it might be an image without a proper extension
      return imageUrl;
    }
    
    // Then try CDN animation URI (might be a video but better than nothing)
    if (cdnAssetUris.cdn_animation_uri) {
      return cdnAssetUris.cdn_animation_uri;
    }
    
    // Then try raw animation URI
    if (cdnAssetUris.raw_animation_uri) {
      const animUrl = this.convertIpfsUrl(cdnAssetUris.raw_animation_uri);
      return animUrl;
    }
    
    // Then try asset URI (might be a JSON file, but some platforms use it for direct image links)
    if (cdnAssetUris.asset_uri) {
      const uri = cdnAssetUris.asset_uri.toLowerCase();
      if (uri.endsWith('.jpg') || uri.endsWith('.jpeg') || uri.endsWith('.png') || 
          uri.endsWith('.gif') || uri.endsWith('.webp') || uri.endsWith('.svg')) {
        const assetUrl = this.convertIpfsUrl(cdnAssetUris.asset_uri);
        return assetUrl;
      }
    }
    
    // If cdn_json_uri exists, try to fetch it and extract the image URL
    if (cdnAssetUris.cdn_json_uri) {
      try {
        // Only attempt to fetch if the URL starts with http/https
        if (!cdnAssetUris.cdn_json_uri.startsWith('http')) {
          return '';
        }
        
        const response = await fetch(cdnAssetUris.cdn_json_uri, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-cache' // Avoid cache issues
        });
        if (response.ok) {
          const metadata = await response.json();
          
          if (metadata.image) {
            return this.convertIpfsUrl(metadata.image);
          }
          // Look for standard NFT metadata fields that might contain an image
          if (metadata.image_url) {
            return this.convertIpfsUrl(metadata.image_url);
          }
          if (metadata.imageUrl) {
            return this.convertIpfsUrl(metadata.imageUrl);
          }
          if (metadata.animation_url) {
            return this.convertIpfsUrl(metadata.animation_url);
          }
          if (metadata.animationUrl) {
            return this.convertIpfsUrl(metadata.animationUrl);
          }
        }
      } catch (error) {
        // Silently handle errors
      }
    }
    
    // If asset_uri points to a JSON file but we haven't tried it yet
    if (cdnAssetUris.asset_uri && !cdnAssetUris.cdn_json_uri && 
        cdnAssetUris.asset_uri.toLowerCase().endsWith('.json')) {
      try {
        // Only attempt to fetch if the URL starts with http/https
        const convertedUrl = this.convertIpfsUrl(cdnAssetUris.asset_uri);
        if (!convertedUrl.startsWith('http')) {
          return '';
        }
        
        const response = await fetch(convertedUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-cache' // Avoid cache issues
        });
        if (response.ok) {
          const metadata = await response.json();
          if (metadata.image) {
            return this.convertIpfsUrl(metadata.image);
          }
          if (metadata.image_url) {
            return this.convertIpfsUrl(metadata.image_url);
          }
          if (metadata.imageUrl) {
            return this.convertIpfsUrl(metadata.imageUrl);
          }
          if (metadata.animation_url) {
            return this.convertIpfsUrl(metadata.animation_url);
          }
          if (metadata.animationUrl) {
            return this.convertIpfsUrl(metadata.animationUrl);
          }
        }
      } catch (error) {
        // Silently handle errors
      }
    }
    
    // If token_uri exists and we haven't explored it yet
    if (token_uri && (!cdnAssetUris.asset_uri || !cdnAssetUris.cdn_json_uri)) {
      try {
        const tokenUri = this.convertIpfsUrl(token_uri);
        
        // Only attempt to fetch if the URL starts with http/https
        if (!tokenUri.startsWith('http')) {
          return '';
        }
        
        const response = await fetch(tokenUri, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-cache' // Avoid cache issues
        });
        if (response.ok) {
          const metadata = await response.json();
          if (metadata.image) {
            return this.convertIpfsUrl(metadata.image);
          }
          if (metadata.image_url) {
            return this.convertIpfsUrl(metadata.image_url);
          }
          if (metadata.imageUrl) {
            return this.convertIpfsUrl(metadata.imageUrl);
          }
          if (metadata.animation_url) {
            return this.convertIpfsUrl(metadata.animation_url);
          }
          if (metadata.animationUrl) {
            return this.convertIpfsUrl(metadata.animationUrl);
          }
        }
      } catch (error) {
        // Silently handle errors
      }
    }
    
    // If asset_uri exists but isn't a JSON, try using it directly
    if (cdnAssetUris.asset_uri && !cdnAssetUris.asset_uri.toLowerCase().endsWith('.json')) {
      const assetUrl = this.convertIpfsUrl(cdnAssetUris.asset_uri);
      // Only return if it's a valid HTTP URL
      if (assetUrl.startsWith('http')) {
        return assetUrl;
      }
    }
    
    return '';
  }

  /**
   * Process an NFT to ensure it has a valid image URL
   * @param nft - NFT object to process
   * @returns Processed NFT with valid image URL
   */
  async processNFTImageUrl(nft: NFT): Promise<NFT> {
    // If we already have a valid image_url, keep it
    if (nft.image_url && !nft.image_url.includes('undefined')) {
      return nft;
    }
    
    // If no image_url is available, use a placeholder
    if (!nft.image_url) {
      const placeholderName = encodeURIComponent(nft.name || 'NFT');
      nft.image_url = `https://placehold.co/500x500/eee/999?text=${placeholderName}`;
    }
    
    return nft;
  }

  /**
   * Fetch active NFT listings from marketplaces
   * @param params - Optional parameters for filtering and pagination
   * @returns Active NFT listings
   */
  async fetchActiveListings(params: {
    page?: number; 
    pageSize?: number; 
    collection?: string; 
    marketplace?: string;
    sortOrder?: string;
    orderByClause?: string;
    hideIncompleteMetadata?: boolean;
    skipCache?: boolean;
  } = {}): Promise<{ nfts: NFT[]; total: number }> {
    const { 
      page = 1, 
      pageSize = 10, 
      collection = undefined, 
      marketplace = undefined,
      sortOrder = 'timestamp_desc',
      orderByClause = 'last_transaction_timestamp',
      hideIncompleteMetadata = false,
      skipCache = false
    } = params;

    // Create a cache key from the params
    const cacheParams = { page, pageSize, collection, marketplace, sortOrder, hideIncompleteMetadata };
    const cacheKey = JSON.stringify(cacheParams);

    // Check if we have a valid cache entry and not explicitly skipping cache
    if (!skipCache && this.listingsCache[cacheKey]) {
      const cacheEntry = this.listingsCache[cacheKey];
      const now = Date.now();
      // Check if cache entry is still valid (not expired)
      if (now - cacheEntry.timestamp < this.CACHE_EXPIRATION) {
        console.log(`Using cached listings for key: ${cacheKey}, age: ${(now - cacheEntry.timestamp) / 1000}s`);
        return cacheEntry.data;
      } else {
        console.log(`Cache expired for key: ${cacheKey}, fetching fresh data`);
      }
    }

    // Map dashboard sort options to GraphQL format
    let orderPart = '';

    // Map sort parameters from UI to GraphQL format
    if (sortOrder) {
      if (sortOrder === 'timestamp_desc') {
        orderPart = 'order_by: {last_transaction_timestamp: desc}';
      } else if (sortOrder === 'timestamp_asc') {
        orderPart = 'order_by: {last_transaction_timestamp: asc}';
      } else if (sortOrder === 'price_desc') {
        orderPart = 'order_by: {price: desc}';
      } else if (sortOrder === 'price_asc') {
        orderPart = 'order_by: {price: asc}';
      } else if (sortOrder === 'version_desc') {
        orderPart = 'order_by: {last_transaction_version: desc}';
      } else if (sortOrder === 'version_asc') {
        orderPart = 'order_by: {last_transaction_version: asc}';
      } else {
        // Default fallback
        orderPart = 'order_by: {last_transaction_timestamp: desc}';
      }
    } else {
      // Default if no sort order specified
      orderPart = 'order_by: {last_transaction_timestamp: desc}';
    }

    // Calculate appropriate limit based on filters applied
    const queryLimit = marketplace ? pageSize * 5 : hideIncompleteMetadata ? pageSize * 3 : pageSize;
    const queryOffset = (hideIncompleteMetadata || marketplace) ? 0 : (page - 1) * pageSize;
    
    // Handle marketplace parameter based on the marketplace
    let marketplaceFilter = '';
    if (marketplace) {
      if (marketplace.toLowerCase() === 'topaz') {
        marketplaceFilter = `marketplace: {_eq: "topaz"}`;
      } else if (marketplace.toLowerCase().includes('tradeport')) {
        marketplaceFilter = `marketplace: {_in: ["tradeport_v1", "tradeport_v2"]}`;
      } else {
        marketplaceFilter = `marketplace: {_ilike: "${marketplace}"}`;
      }
    }
    
    const smallQuery = `
      query ActiveListingsSimple {
        current_nft_marketplace_listings(
          limit: ${queryLimit}
          offset: ${queryOffset}
          where: {
            is_deleted: {_eq: false}
            ${marketplaceFilter ? marketplaceFilter : ''}
            ${collection ? `, collection_data: {collection_name: {_ilike: "%${collection}%"}}` : ''}
          }
          ${orderPart}
        ) {
          token_name
          token_data_id
          seller
          price
          marketplace
          listing_id
          last_transaction_timestamp
          collection_id
          collection_data {
            collection_name
            uri
            creator_address
          }
          current_token_data {
            token_uri
            token_name
            description
            cdn_asset_uris {
              cdn_image_uri
              asset_uri
              cdn_animation_uri
              raw_animation_uri
              raw_image_uri
              cdn_json_uri
            }
          }
        }
        
        # Get the total count for pagination
        current_nft_marketplace_listings_aggregate(
          where: {
            is_deleted: {_eq: false}
            ${marketplaceFilter ? marketplaceFilter : ''}
            ${collection ? `, collection_data: {collection_name: {_ilike: "%${collection}%"}}` : ''}
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    try {
      // Use our AptosClient to execute the GraphQL query
      const responseData = await this.client.queryGraphQL<any>(smallQuery, {}, this.client.getNftIndexerEndpoint());
      
      // Check if data property exists in the response
      if (!responseData || !responseData.data) {
        return { nfts: [], total: 0 };
      }
      
      // Access the data property from the response
      const data = responseData.data;
      
      if (!data.current_nft_marketplace_listings) {
        return { nfts: [], total: 0 };
      }
      
      const listings = data.current_nft_marketplace_listings || [];
      // Get the total listings count for pagination
      const totalCount = data.current_nft_marketplace_listings_aggregate?.aggregate?.count || listings.length;
      
      // Transform the data to match our NFT type and filter out items with no token name
      const nftsPromises = listings
        .filter((listing: any) => {
          // For Topaz, be more lenient and keep all listings
          if (listing.marketplace && listing.marketplace.toLowerCase().includes('topaz')) {
            return true;
          }
          
          // For other marketplaces, check token name as usual
          return !!(listing.token_name || 
                    (listing.current_token_data && listing.current_token_data.token_name));
        })
        .map(async (listing: any): Promise<NFT> => {
          const tokenData = listing.current_token_data || {};
          const collectionData = listing.collection_data || {};
          
          // Get the best available image URL using our helper
          let imageUrl = '';
          if (tokenData.cdn_asset_uris) {
            try {
              imageUrl = await this.getBestImageUrl(
                tokenData.cdn_asset_uris, 
                listing.token_name || tokenData.token_name,
                tokenData.token_uri
              );
            } catch (error) {
              // If image URL fetching fails, continue with a placeholder
            }
          }
          
          // If we don't have any usable URL, generate a placeholder
          if (!imageUrl) {
            const placeholderId = listing.token_name || Math.random().toString(36).substring(7);
            imageUrl = `https://placehold.co/500x500/eee/999?text=${encodeURIComponent(placeholderId)}`;
          }
          
          // Check if metadata is complete
          const hasCompleteName = !!(listing.token_name || tokenData.token_name);
          const hasDescription = !!tokenData.description;
          const hasImage = !!imageUrl;
          const hasCompleteMetadata = (hasCompleteName && hasDescription && hasImage);
          
          return {
            id: listing.token_data_id || `listing-${listing.listing_id}`,
            name: listing.token_name || tokenData.token_name || `NFT #${listing.listing_id || 'Unknown'}`,
            description: tokenData.description || collectionData.description || 'No description available',
            image_url: imageUrl,
            marketplace: this.formatMarketplaceName(listing.marketplace || 'Unknown'),
            collection_name: collectionData.collection_name || 'Unknown Collection',
            creator_address: collectionData.creator_address || '',
            owner_address: listing.seller || '',
            price: {
              amount: listing.price ? parseFloat(listing.price) / 100000000 : 0, // Convert from octas to APT
              currency: 'APT',
            },
            token_properties: this.parseTokenProperties(tokenData.token_properties),
            created_at: listing.last_transaction_timestamp ? new Date(listing.last_transaction_timestamp).toISOString() : new Date().toISOString(),
            listing_id: listing.listing_id || '',
            collection_id: tokenData.collection_id || listing.collection_id || '',
            token_uri: tokenData.token_uri || collectionData.uri || '',
            hasCompleteMetadata: hasCompleteMetadata,
          };
        });
      
      // Wait for all NFT processing to complete
      const nfts = await Promise.all(nftsPromises);
      
      // Filter out NFTs with incomplete metadata if requested
      const filteredNfts = hideIncompleteMetadata 
        ? nfts.filter((nft: NFT) => nft.hasCompleteMetadata) 
        : nfts;
      
      // If we're hiding incomplete metadata, we need to handle pagination manually
      let paginatedNfts = filteredNfts;
      if (hideIncompleteMetadata) {
        // Apply pagination manually
        const startIndex = (page - 1) * pageSize;
        paginatedNfts = filteredNfts.slice(startIndex, startIndex + pageSize);
      }

      // Return without processing NFT image URLs - just use what we have
      const result = {
        nfts: paginatedNfts,
        total: hideIncompleteMetadata ? filteredNfts.length : totalCount, 
      };
      
      // Store in cache with current timestamp
      this.listingsCache[cacheKey] = {
        timestamp: Date.now(),
        data: result,
        params: cacheKey
      };
      
      return result;
    } catch (error) {
      console.error('Error fetching active listings:', error);
      return { nfts: [], total: 0 };
    }
  }

  /**
   * Manual cache invalidation for fetchActiveListings
   * @param specificParams - Optional specific params to invalidate, or all cache if undefined
   */
  invalidateListingsCache(specificParams?: any): void {
    if (specificParams) {
      // Invalidate specific cache entry
      const cacheKey = JSON.stringify(specificParams);
      if (this.listingsCache[cacheKey]) {
        delete this.listingsCache[cacheKey];
        console.log(`Invalidated listings cache for key: ${cacheKey}`);
      }
    } else {
      // Invalidate all cache entries
      Object.keys(this.listingsCache).forEach(key => {
        delete this.listingsCache[key];
      });
      console.log('Invalidated all listings cache entries');
    }
  }

  /**
   * Parse token properties from string to object
   * @param properties - Token properties as string
   * @returns Parsed token properties or undefined
   */
  parseTokenProperties(properties: string | null | undefined): Record<string, string> | undefined {
    if (!properties) return undefined;
    
    try {
      return JSON.parse(properties);
    } catch (error) {
      console.error('Error parsing token properties:', error);
      return undefined;
    }
  }

  /**
   * Formats an APT amount from octas (smallest unit) to APT (display unit)
   * @param octas - Amount in octas (string or number)
   * @returns - Amount in APT as a number
   */
  formatAPTAmount(octas: string | number): number {
    const amount = typeof octas === 'string' ? BigInt(octas) : BigInt(Math.floor(Number(octas)));
    return Number(amount) / 100000000; // 8 decimal places for APT
  }

  /**
   * Fetch NFT details by ID
   * @param nftId - The ID of the NFT to fetch
   * @returns - Detailed NFT information
   */
  async fetchNFTDetails(nftId: string): Promise<NFT | null> {
    try {
      const query = `
        query GetNFTDetailsByTokenId {
          current_token_datas_v2(where: {token_data_id: {_eq: "${nftId}"}}) {
            token_data_id
            token_name
            token_uri
            description
            token_properties
            token_standard
            collection_id
            supply
            maximum
            last_transaction_timestamp
            cdn_asset_uris {
              cdn_image_uri
              asset_uri
              cdn_animation_uri
              raw_animation_uri
              raw_image_uri
              cdn_json_uri
            }
          }
          current_nft_marketplace_listings(where: {token_data_id: {_eq: "${nftId}"}, is_deleted: {_eq: false}}, limit: 1) {
            listing_id
            price
            marketplace
            seller
            last_transaction_timestamp
            collection_data {
              collection_name
            }
          }
        }
      `;
      
      const response = await this.client.queryGraphQL<any>(query, {}, this.client.getNftIndexerEndpoint());
      
      if (response && response.current_token_datas_v2 && response.current_token_datas_v2.length > 0) {
        const tokenData = response.current_token_datas_v2[0];
        const listing = response.current_nft_marketplace_listings?.[0];
        const collectionName = listing?.collection_data?.collection_name || '';
        
        // Get the best image URL
        let imageUrl = '';
        if (tokenData.cdn_asset_uris) {
          try {
            imageUrl = await this.getBestImageUrl(
              tokenData.cdn_asset_uris,
              tokenData.token_name || 'NFT',
              tokenData.token_uri
            );
          } catch (error) {
            // If image URL fetching fails, continue with a placeholder
          }
        }
        
        // Use placeholder if no image found
        if (!imageUrl) {
          const placeholderName = encodeURIComponent(tokenData.token_name || 'NFT');
          imageUrl = `https://placehold.co/500x500/eee/999?text=${placeholderName}`;
        }
        
        return {
          id: tokenData.token_data_id,
          name: tokenData.token_name || 'Unnamed NFT',
          description: tokenData.description || '',
          image_url: imageUrl,
          marketplace: this.formatMarketplaceName(listing ? listing.marketplace : ''),
          collection_name: collectionName,
          creator_address: tokenData.creator_address || '',
          owner_address: listing ? listing.seller : '',
          price: listing ? {
            amount: this.formatAPTAmount(listing.price),
            currency: 'APT'
          } : undefined,
          token_properties: this.parseTokenProperties(tokenData.token_properties),
          created_at: new Date(tokenData.last_transaction_timestamp).toISOString(),
          listing_id: listing ? listing.listing_id : '',
          collection_id: tokenData.collection_id,
          token_uri: tokenData.token_uri,
          hasCompleteMetadata: !!(tokenData.token_name && tokenData.description && imageUrl)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching NFT details:', error);
      return null;
    }
  }

  /**
   * Fetches collections ranked by volume
   * @param options - Collection ranking options
   * @returns - Ranked collections
   */
  async fetchCollectionsByVolume(options?: CollectionRankingOptions): Promise<any[]> {
    try {
      const timePeriod = options?.timePeriod || '24h';
      const limit = options?.limit || 10;
      const offset = options?.offset || 0;
      
      const path = '/collections/list_by_volume';
      const params = {
        time_period: timePeriod,
        limit,
        offset
      };
      
      const response = await this.client.queryAnalytics<any[]>(path, params);
      
      if (response) {
        return response;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching collections by volume:', error);
      return [];
    }
  }

  /**
   * Fetches collections ranked by sales
   * @param options - Collection ranking options
   * @returns - Ranked collections
   */
  async fetchCollectionsBySales(options?: CollectionRankingOptions): Promise<any[]> {
    try {
      const timePeriod = options?.timePeriod || '24h';
      const limit = options?.limit || 10;
      const offset = options?.offset || 0;
      
      const path = '/collections/list_by_sales';
      const params = {
        time_period: timePeriod,
        limit,
        offset
      };
      
      const response = await this.client.queryAnalytics<any[]>(path, params);
      
      if (response) {
        return response;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching collections by sales:', error);
      return [];
    }
  }

  /**
   * Fetches collections ranked by floor price
   * @param options - Collection ranking options
   * @returns - Ranked collections
   */
  async fetchCollectionsByFloorPrice(options?: CollectionRankingOptions): Promise<any[]> {
    try {
      const timePeriod = options?.timePeriod || '24h';
      const limit = options?.limit || 10;
      const offset = options?.offset || 0;
      
      const path = '/collections/list_by_floor_price';
      const params = {
        time_period: timePeriod,
        limit,
        offset
      };
      
      const response = await this.client.queryAnalytics<any[]>(path, params);
      
      if (response) {
        return response;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching collections by floor price:', error);
      return [];
    }
  }

} 

interface NFTListing {
  id: string;
  marketplace_id: string;
  marketplace_name: string;
  marketplace_logo_url: string;
  price_apt: string;
  price_usd: number;
  listing_url: string;
  raw_data: any;
  created_at?: Date;
} 