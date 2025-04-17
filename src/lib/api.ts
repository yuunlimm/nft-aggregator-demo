import { NFT, MarketplaceConfig, AggregatorStats } from '../types';

// Aptos NFT Indexer GraphQL endpoint for marketplace data
const APTOS_NFT_INDEXER_ENDPOINT = 'https://api.mainnet.aptoslabs.com/nft-aggregator-staging/v1/graphql';

// Aptos Analytics REST API base URL
const APTOS_ANALYTICS_API = 'https://api.mainnet.aptoslabs.com/v1/analytics';

// Cache for metadata fetching
const metadataCache: Record<string, any> = {};

// New cache for active listings with expiration
interface ListingsCache {
  timestamp: number;
  data: { nfts: NFT[]; total: number };
  params: string; // JSON stringified params for cache key
}

// Cache object to store listings with a 5-minute expiration
const listingsCache: Record<string, ListingsCache> = {};
// Default cache expiration time (5 minutes in milliseconds)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Format marketplace name for display
 * Removes suffixes like "_v2" and capitalizes the name
 */
function formatMarketplaceName(name: string): string {
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
 * Extract base marketplace name for grouping purposes
 * e.g., tradeport_v1 and tradeport_v2 should both return "tradeport"
 */
function getBaseMarketplaceName(name: string): string {
  if (!name) return 'unknown';
  
  // Convert to lowercase and remove version suffixes
  return name.toLowerCase()
    .replace(/_v\d+$/i, '')  // Remove _v1, _v2, etc.
    .replace(/_\d+$/i, '')   // Remove _1, _2, etc.
    .replace(/[-_]/g, '');   // Remove hyphens and underscores
}

/**
 * Helper to convert IPFS URLs to HTTP URLs for display in browsers
 */
function convertIpfsUrl(url: string): string {
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
 * Handles cases where cdn_image_uri is null but other fields are available
 */
async function getBestImageUrl(cdnAssetUris: any, token_name: string, token_uri?: string): Promise<string> {
  if (!cdnAssetUris) return '';
  
  // First try the CDN image URI if available (second priority)
  if (cdnAssetUris.cdn_image_uri) {
    return cdnAssetUris.cdn_image_uri;
  }
  
  // Then try raw image URI if we didn't already handle it in the special cases
  if (cdnAssetUris.raw_image_uri) {
    // Convert IPFS URL if needed
    const imageUrl = convertIpfsUrl(cdnAssetUris.raw_image_uri);
    
    // Check if it's an image or video
    const uri = imageUrl.toLowerCase();
    if (uri.endsWith('.jpg') || uri.endsWith('.jpeg') || uri.endsWith('.png') || 
        uri.endsWith('.gif') || uri.endsWith('.webp') || uri.endsWith('.svg')) {
      return imageUrl;
    }
    
    // For videos and other media, still use it but log
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
    const animUrl = convertIpfsUrl(cdnAssetUris.raw_animation_uri);
    return animUrl;
  }
  
  // Then try asset URI (might be a JSON file, but some platforms use it for direct image links)
  if (cdnAssetUris.asset_uri) {
    const uri = cdnAssetUris.asset_uri.toLowerCase();
    if (uri.endsWith('.jpg') || uri.endsWith('.jpeg') || uri.endsWith('.png') || 
        uri.endsWith('.gif') || uri.endsWith('.webp') || uri.endsWith('.svg')) {
      const assetUrl = convertIpfsUrl(cdnAssetUris.asset_uri);
      return assetUrl;
    }
  }
  
  // If cdn_json_uri exists, try to fetch it and extract the image URL
  if (cdnAssetUris.cdn_json_uri) {
    try {
      const response = await fetch(cdnAssetUris.cdn_json_uri, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache' // Avoid cache issues
      });
      if (response.ok) {
        const metadata = await response.json();
        
        if (metadata.image) {
          return convertIpfsUrl(metadata.image);
        }
        // Look for standard NFT metadata fields that might contain an image
        if (metadata.image_url) {
          return convertIpfsUrl(metadata.image_url);
        }
        if (metadata.imageUrl) {
          return convertIpfsUrl(metadata.imageUrl);
        }
        if (metadata.animation_url) {
          return convertIpfsUrl(metadata.animation_url);
        }
        if (metadata.animationUrl) {
          return convertIpfsUrl(metadata.animationUrl);
        }
      }
    } catch (error) {
      console.error(`Error fetching JSON metadata from ${cdnAssetUris.cdn_json_uri}:`, error);
    }
  }
  
  // If asset_uri points to a JSON file but we haven't tried it yet
  if (cdnAssetUris.asset_uri && !cdnAssetUris.cdn_json_uri && 
      cdnAssetUris.asset_uri.toLowerCase().endsWith('.json')) {
    try {
      const response = await fetch(convertIpfsUrl(cdnAssetUris.asset_uri), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache' // Avoid cache issues
      });
      if (response.ok) {
        const metadata = await response.json();
        if (metadata.image) {
          return convertIpfsUrl(metadata.image);
        }
        if (metadata.image_url) {
          return convertIpfsUrl(metadata.image_url);
        }
        if (metadata.imageUrl) {
          return convertIpfsUrl(metadata.imageUrl);
        }
        if (metadata.animation_url) {
          return convertIpfsUrl(metadata.animation_url);
        }
        if (metadata.animationUrl) {
          return convertIpfsUrl(metadata.animationUrl);
        }
      }
    } catch (error) {
    }
  }
  
  // If token_uri exists and we haven't explored it yet
  if (token_uri && (!cdnAssetUris.asset_uri || !cdnAssetUris.cdn_json_uri)) {
    try {
      const tokenUri = convertIpfsUrl(token_uri);
      const response = await fetch(tokenUri, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache' // Avoid cache issues
      });
      if (response.ok) {
        const metadata = await response.json();
        if (metadata.image) {
          return convertIpfsUrl(metadata.image);
        }
        if (metadata.image_url) {
          return convertIpfsUrl(metadata.image_url);
        }
        if (metadata.imageUrl) {
          return convertIpfsUrl(metadata.imageUrl);
        }
        if (metadata.animation_url) {
          return convertIpfsUrl(metadata.animation_url);
        }
        if (metadata.animationUrl) {
          return convertIpfsUrl(metadata.animationUrl);
        }
      }
    } catch (error) {
      console.error(`Error fetching JSON metadata from token_uri:`, error);
    }
  }
  
  // If asset_uri exists but isn't a JSON, try using it directly
  if (cdnAssetUris.asset_uri && !cdnAssetUris.asset_uri.toLowerCase().endsWith('.json')) {
    const assetUrl = convertIpfsUrl(cdnAssetUris.asset_uri);
    return assetUrl;
  }
  
  return '';
}

/**
 * Fetch active NFT listings from marketplaces
 * @param params Optional parameters for filtering and pagination
 */
export async function fetchActiveListings(params: {
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
  if (!skipCache && listingsCache[cacheKey]) {
    const cacheEntry = listingsCache[cacheKey];
    const now = Date.now();
    // Check if cache entry is still valid (not expired)
    if (now - cacheEntry.timestamp < CACHE_EXPIRATION) {
      return cacheEntry.data;
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

  const offset = (page - 1) * pageSize;
  
  try {
    // Calculate appropriate limit based on filters applied
    const queryLimit = marketplace ? pageSize * 5 : hideIncompleteMetadata ? pageSize * 3 : pageSize;
    const queryOffset = (hideIncompleteMetadata || marketplace) ? 0 : offset;
    
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
    
    // Reduce the complexity of the query to avoid rate limiting
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

    const response = await fetchWithRetry(APTOS_NFT_INDEXER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: smallQuery }),
    }, 0); // No retries

    if (!response.ok) {
      console.error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      return { nfts: [], total: 0 };
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { nfts: [], total: 0 };
    }
    
    if (!data.data || !data.data.current_nft_marketplace_listings) {
      console.error('Invalid response structure from NFT Indexer API');
      return { nfts: [], total: 0 };
    }
    
    const listings = data.data.current_nft_marketplace_listings || [];
    // Get the total listings count for pagination
    const totalCount = data.data.current_nft_marketplace_listings_aggregate?.aggregate?.count || listings.length;

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
            imageUrl = await getBestImageUrl(
              tokenData.cdn_asset_uris,
              tokenData.token_name || 'NFT',
              tokenData.token_uri
            );
          } catch (error) {
            // If image URL fetching fails, continue without an image
          }
        }
        
        // If no image URL is available, use a placeholder
        if (!imageUrl) {
          const placeholderName = encodeURIComponent(tokenData.token_name || 'NFT');
          imageUrl = `https://placehold.co/500x500/eee/999?text=${placeholderName}`;
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
          marketplace: formatMarketplaceName(listing.marketplace || 'Unknown'),
          collection_name: collectionData.collection_name || 'Unknown Collection',
          creator_address: collectionData.creator_address || '',
          owner_address: listing.seller || '',
          price: {
            amount: listing.price ? parseFloat(listing.price) / 100000000 : 0, // Convert from octas to APT
            currency: 'APT',
          },
          token_properties: parseTokenProperties(tokenData.token_properties),
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
    listingsCache[cacheKey] = {
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
 * Call this function when data needs to be refreshed
 * @param specificParams Optional specific params to invalidate, or all cache if undefined
 */
export function invalidateListingsCache(specificParams?: any): void {
  if (specificParams) {
    // Invalidate specific cache entry
    const cacheKey = JSON.stringify(specificParams);
    if (listingsCache[cacheKey]) {
      delete listingsCache[cacheKey];
    }
  } else {
    // Invalidate all cache entries
    Object.keys(listingsCache).forEach(key => {
      delete listingsCache[key];
    });
  }
}

/**
 * Fetch details for a specific NFT by ID
 */
export async function fetchNFTDetails(nftId: string): Promise<NFT | null> {
  try {
    const response = await fetchWithRetry(APTOS_NFT_INDEXER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
    query GetNFTDetailsById {
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
  ` }),
    });

    if (!response.ok) {
      console.error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }
    
    const tokenData = data.data?.current_token_datas_v2?.[0];
    const listing = data.data?.current_nft_marketplace_listings?.[0];
    const collectionName = listing?.collection_data?.collection_name || '';
    if (!tokenData) {
      return null;
    }

    // Get the best available image URL using our helper
    let imageUrl = '';
    if (tokenData.cdn_asset_uris) {
      try {
        imageUrl = await getBestImageUrl(
          tokenData.cdn_asset_uris,
          tokenData.token_name || 'NFT',
          tokenData.token_uri
        );
      } catch (error) {
        // If image URL fetching fails, continue without an image
      }
    }
    
    // If no image URL is available, use a placeholder
    if (!imageUrl) {
      const placeholderName = encodeURIComponent(tokenData.token_name || 'NFT');
      imageUrl = `https://placehold.co/500x500/eee/999?text=${placeholderName}`;
    }

    return {
      id: tokenData.token_data_id_hash,
      name: tokenData.token_name || 'Unnamed NFT',
      description: tokenData.description || '',
      image_url: imageUrl,
      marketplace: formatMarketplaceName(listing ? listing.marketplace : ''),
      collection_name: collectionName,
      creator_address: tokenData.creator_address || '',
      owner_address: listing ? listing.seller : '', // If listed, the seller is the owner
      price: listing ? {
        amount: parseFloat(listing.price) / 100000000, // Convert from octas to APT
        currency: 'APT'
      } : undefined,
      token_properties: parseTokenProperties(tokenData.token_properties),
      created_at: new Date(tokenData.last_transaction_timestamp).toISOString(),
      
      // Additional details
      supply: tokenData.supply,
      maximum: tokenData.maximum,
      token_uri: tokenData.token_uri,
      collection_id: tokenData.collection_id,
      listing_id: listing ? listing.listing_id : undefined,
    };
  } catch (error) {
    console.error('Error fetching NFT details:', error);
    return null;
  }
}

/**
 * Fetch marketplace configurations
 */
export async function fetchMarketplaceConfigs(): Promise<MarketplaceConfig[]> {
  // Get actual marketplaces from the active listings
  try {
    const query = `
      query GetActiveMarketplaces {
        current_nft_marketplace_listings(
          where: {is_deleted: {_eq: false}}
          distinct_on: marketplace
        ) {
          marketplace
        }
      }
    `;
    
    const response = await fetchWithRetry(APTOS_NFT_INDEXER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL query returned errors:', data.errors);
      return [];
    }
    
    const marketplaceItems = data.data?.current_nft_marketplace_listings || [];
    
    // Ensure we have some data, otherwise return empty array
    if (marketplaceItems.length === 0) {
      return [];
    }
    
    // Group marketplaces by their base name
    const groupedMarketplaces: Record<string, string[]> = {};
    
    marketplaceItems.forEach((item: any) => {
      const marketplaceName = item.marketplace || 'unknown';
      
      // Skip Topaz (deprecated)
      if (marketplaceName.toLowerCase().includes('topaz')) {
        return;
      }
      
      // For TradePort, use a consistent base name
      let baseName = marketplaceName.toLowerCase().includes('tradeport') 
        ? 'tradeport'
        : getBaseMarketplaceName(marketplaceName);
      
      if (!groupedMarketplaces[baseName]) {
        groupedMarketplaces[baseName] = [];
      }
      
      // Only add unique values
      if (!groupedMarketplaces[baseName].includes(marketplaceName)) {
        groupedMarketplaces[baseName].push(marketplaceName);
      }
    });
    
    // If after filtering we have no marketplaces, return empty array
    if (Object.keys(groupedMarketplaces).length === 0) {
      return [];
    }
    
    // Transform grouped marketplace data
    return Object.entries(groupedMarketplaces).map(([baseName, versionNames], index): MarketplaceConfig => {
      const displayName = formatMarketplaceName(baseName);
      
      // For TradePort, we'll include both v1 and v2 versions
      const rawValues = baseName === 'tradeport'
        ? 'tradeport_v1,tradeport_v2'  // Include both versions for TradePort
        : versionNames.join(',');
      
      // Make a clean domain name for the URL
      const domainName = baseName.replace(/_.*$/, '');
      
      return {
        id: (index + 1).toString(),
        name: displayName,
        logo_url: `https://${domainName}.io/logo.png`, // Generic logo URL
        website_url: `https://${domainName}.io/`,
        is_connected: true,
        supported_chains: ['Aptos'],
        last_synced_at: new Date().toISOString(),
        rawValues: rawValues,
      };
    });
  } catch (error) {
    console.error('Error fetching marketplace configs:', error);
    return [];
  }
}

/**
 * Fetch aggregator statistics
 */
export async function fetchAggregatorStats(): Promise<AggregatorStats> {
  try {
    const marketplaceConfigs = await fetchMarketplaceConfigs();
    
    // 1. Get total active listings count from GraphQL - this one works
    const listingsCountQuery = `
      query GetActiveListingsCount {
        current_nft_marketplace_listings_aggregate(
          where: {
            is_deleted: {_eq: false}
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const listingsResponse = await fetchWithRetry(APTOS_NFT_INDEXER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: listingsCountQuery }),
    });
  
    let totalActiveListings = 0;

    if (listingsResponse.ok) {
      const data = await listingsResponse.json();
      totalActiveListings = data.data?.current_nft_marketplace_listings_aggregate?.aggregate?.count || 0;
    } else {
      console.error('❌ Failed to get listings count:', await listingsResponse.text());
    }
    return {
      total_marketplaces: 4,
      total_active_listings: totalActiveListings,
    };
  } catch (error) {
    console.error('Error fetching aggregator stats:', error);
    return {
      total_marketplaces: 0,
      total_active_listings: 0,
      total_value_usd: 0,
    };
  }
}

/**
 * Helper to parse token properties from string to object
 */
function parseTokenProperties(properties: string | null | undefined): Record<string, string> | undefined {
  if (!properties) return undefined;
  
  try {
    return JSON.parse(properties);
  } catch (error) {
    console.error('Error parsing token properties:', error);
    return undefined;
  }
}

/**
 * Connect to a marketplace using an API key (simulated)
 */
export async function connectMarketplace(
  marketplaceId: string, 
  apiKey: string
): Promise<boolean> {
  return true;
}

/**
 * Disconnect from a marketplace (simulated)
 */
export async function disconnectMarketplace(marketplaceId: string): Promise<boolean> {
  return true;
}

/**
 * Helper function for GraphQL requests with retry logic
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 0, backoff = 5000): Promise<Response> {
  // No retries - just forward the fetch call directly
  try {
    return await fetch(url, options);
  } catch (error) {
    console.error(`Fetch error:`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Fetch top NFT collections sorted by trading volume
 * @param params Optional parameters for fetching collections
 */
export async function fetchCollectionsByVolume(params: {
  limit?: number;
  offset?: number;
  timePeriod?: '1h' | '6h' | '24h' | '1d' | '7d' | '30d';
} = {}): Promise<any[]> {
  const { 
    limit = 10, 
    offset = 0, 
    timePeriod = '24h' 
  } = params;

  console.log(`Fetching collections by volume`, { limit, offset, timePeriod });

  try {
    // Build the URL with query parameters
    const url = new URL(`${APTOS_ANALYTICS_API}/nft/collection/list_by_volume`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('time_period', timePeriod);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`REST API request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    console.log('Collections by volume:', data);

    // Process the collections to convert amounts
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((collection: any) => ({
        ...collection,
        // Convert volume from octas to APT for display
        total_volume_apt: formatAPTAmount(collection.total_volume_apt),
        // Add extra fields that might be useful
        volume_change_percentage: collection.volume_change_percentage || 0,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching collections by volume:', error);
    return [];
  }
}

/**
 * Fetch top NFT collections sorted by number of sales
 * @param params Optional parameters for fetching collections
 */
export async function fetchCollectionsBySales(params: {
  limit?: number;
  offset?: number;
  timePeriod?: '1h' | '6h' | '24h' | '1d' | '7d' | '30d';
} = {}): Promise<any[]> {
  const { 
    limit = 10, 
    offset = 0, 
    timePeriod = '24h' 
  } = params;

  console.log(`Fetching collections by sales`, { limit, offset, timePeriod });

  try {
    // Build the URL with query parameters
    const url = new URL(`${APTOS_ANALYTICS_API}/nft/collection/list_by_sales`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('time_period', timePeriod);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`REST API request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    console.log('Collections by sales:', data);

    // Process the collections
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((collection: any) => ({
        ...collection,
        // Convert volume from octas to APT for display
        total_volume_apt: formatAPTAmount(collection.total_volume_apt),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching collections by sales:', error);
    return [];
  }
}

/**
 * Fetch top NFT collections sorted by floor price
 * @param params Optional parameters for fetching collections
 */
export async function fetchCollectionsByFloorPrice(params: {
  limit?: number;
  offset?: number;
  timePeriod?: '1h' | '6h' | '24h' | '1d' | '7d' | '30d';
} = {}): Promise<any[]> {
  const { 
    limit = 10, 
    offset = 0, 
    timePeriod = '24h' 
  } = params;

  console.log(`Fetching collections by floor price`, { limit, offset, timePeriod });

  try {
    // Build the URL with query parameters
    const url = new URL(`${APTOS_ANALYTICS_API}/nft/collection/list_by_floor_price`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('time_period', timePeriod);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`REST API request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    console.log('Collections by floor price:', data);

    // Process the collections
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((collection: any) => ({
        ...collection,
        // Convert floor price from octas to APT for display
        floor_price_apt: formatAPTAmount(collection.floor_price_apt),
        // Convert volume from octas to APT for display if available
        total_volume_apt: collection.total_volume_apt ? formatAPTAmount(collection.total_volume_apt) : undefined,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching collections by floor price:', error);
    return [];
  }
}

/**
 * Get collection details including total sales volume, top buyers, top sellers
 * @param collectionId The collection ID to fetch details for
 */
export async function fetchCollectionDetails(collectionId: string): Promise<any> {
  console.log(`Fetching details for collection: ${collectionId}`);
  
  try {
    // Make parallel requests to get all collection details
    const [totalSalesResponse, totalVolumeResponse, topBuyersResponse, topSellersResponse] = await Promise.all([
      fetch(`${APTOS_ANALYTICS_API}/nft/collection/total_sales_count?collection_id=${collectionId}`),
      fetch(`${APTOS_ANALYTICS_API}/nft/collection/total_sales_volume?collection_id=${collectionId}`),
      fetch(`${APTOS_ANALYTICS_API}/nft/collection/top_buyer?collection_id=${collectionId}&limit=5`),
      fetch(`${APTOS_ANALYTICS_API}/nft/collection/top_seller?collection_id=${collectionId}&limit=5`)
    ]);
    
    // Process responses
    let totalSales = 0;
    let totalVolume = 0;
    let topBuyers: any[] = [];
    let topSellers: any[] = [];
    
    if (totalSalesResponse.ok) {
      const salesData = await totalSalesResponse.json();
      totalSales = salesData.data || 0;
    }
    
    if (totalVolumeResponse.ok) {
      const volumeData = await totalVolumeResponse.json();
      totalVolume = formatAPTAmount(volumeData.data || 0);
    }
    
    if (topBuyersResponse.ok) {
      const buyersData = await topBuyersResponse.json();
      topBuyers = (buyersData.data || []).map((buyer: any) => ({
        ...buyer,
        total_spent: formatAPTAmount(buyer.total_spent)
      }));
    }
    
    if (topSellersResponse.ok) {
      const sellersData = await topSellersResponse.json();
      topSellers = (sellersData.data || []).map((seller: any) => ({
        ...seller,
        total_volume: formatAPTAmount(seller.total_volume)
      }));
    }
    
    return {
      collection_id: collectionId,
      total_sales: totalSales,
      total_volume_apt: totalVolume,
      top_buyers: topBuyers,
      top_sellers: topSellers
    };
  } catch (error) {
    console.error(`Error fetching collection details for ${collectionId}:`, error);
    return {
      collection_id: collectionId,
      total_sales: 0,
      total_volume_apt: 0,
      top_buyers: [],
      top_sellers: []
    };
  }
}

/**
 * Get marketplace statistics
 * @param marketplace The marketplace identifier
 */
export async function fetchMarketplaceStats(marketplace: string): Promise<any> {
  console.log(`Fetching stats for marketplace: ${marketplace}`);
  
  try {
    const response = await fetch(`${APTOS_ANALYTICS_API}/nft/marketplace/total_sales_count?marketplace=${marketplace}`);
    
    if (!response.ok) {
      console.error(`REST API request failed: ${response.status} ${response.statusText}`);
      return { total_sales: 0 };
    }
    
    const data = await response.json();
    return { 
      marketplace,
      total_sales: data.data || 0
    };
  } catch (error) {
    console.error(`Error fetching marketplace stats for ${marketplace}:`, error);
    return { 
      marketplace,
      total_sales: 0 
    };
  }
}

/**
 * Formats APT amount from octas to APT with proper formatting
 * @param octas Amount in octas (the smallest unit of APT)
 * @returns Formatted APT amount
 */
function formatAPTAmount(octas: string | number): number {
  if (!octas) return 0;
  
  // Convert string to number if necessary
  const octasNum = typeof octas === 'string' ? parseFloat(octas) : octas;
  
  // Convert from octas to APT (1 APT = 100,000,000 octas)
  return octasNum / 100000000;
}

export interface CollectionRankingOptions {
  timePeriod?: '1h' | '6h' | '24h' | '7d' | '30d';
  limit?: number;
  offset?: number;
}
