import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

/**
 * AptosClient - A wrapper class for the Aptos SDK that supports API key authentication
 * This class encapsulates all API interactions with Aptos in one place
 */
export class AptosClient {
  private readonly provider: Aptos;
  private readonly nftIndexerEndpoint: string;
  private readonly indexerEndpoint: string;
  private readonly analyticsEndpoint: string;
  private readonly apiKey?: string;

  /**
   * Creates a new AptosClient instance
   * @param apiKey - Optional API key for authentication
   * @param network - Aptos network to connect to (defaults to MAINNET)
   */
  constructor(
    apiKey?: string,
    network: Network = Network.MAINNET,
    endpoints?: {
      nftIndexer?: string;
      indexer?: string;
      analytics?: string;
    }
  ) {
    // Store API key for later use
    this.apiKey = apiKey;
    
    // Configure the Aptos provider
    const config = new AptosConfig({ network });

    this.provider = new Aptos(config);
    
    // Set API endpoints (using defaults or overrides)
    this.nftIndexerEndpoint = endpoints?.nftIndexer || 
      'https://api.mainnet.aptoslabs.com/nft-aggregator-staging/v1/graphql';
    this.indexerEndpoint = endpoints?.indexer || 
      'https://indexer.mainnet.aptoslabs.com/v1/graphql';
    this.analyticsEndpoint = endpoints?.analytics || 
      'https://api.mainnet.aptoslabs.com/v1/analytics';
  }

  /**
   * Send a GraphQL query to the Aptos indexer using the provider with API key
   * @param query - GraphQL query string
   * @param variables - GraphQL variables
   * @param endpoint - Optional specific endpoint to use
   * @returns The query result
   */
  async queryGraphQL<T extends object>(
    query: string, 
    variables?: Record<string, any>,
    endpoint?: string
  ): Promise<T> {
    try {
      // Format GraphQL query for the indexer
      const graphqlQuery = {
        query,
        variables: variables || {}
      };

      // If querying NFT indexer or default indexer, use the provider's queryIndexer
      if (!endpoint || 
          endpoint === this.nftIndexerEndpoint || 
          endpoint === this.indexerEndpoint) {
        // For the provider's queryIndexer, we'll use the regular fetch approach
        // with the API key instead, to ensure compatibility
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Add API key if available
        if (this.apiKey) {
          headers['x-api-key'] = this.apiKey;
        }
        
        const queryEndpoint = endpoint || this.indexerEndpoint;
        const response = await fetch(queryEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(graphqlQuery)
        });

        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }
        
        return data.data as T;
      }
      
      // For other endpoints, use same fetch approach
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add API key if available
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(graphqlQuery)
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }
      
      return data.data as T;
    } catch (error) {
      console.error('Error in queryGraphQL:', error);
      throw error;
    }
  }

  /**
   * Send a request to the analytics API
   * @param path - API path to append to the base analytics URL
   * @param params - Query parameters to include
   * @returns The response data
   */
  async queryAnalytics<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    try {
      // Build URL with parameters
      const url = new URL(`${this.analyticsEndpoint}${path}`);
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      // Add API key if available
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Analytics API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data as T;
    } catch (error) {
      console.error('Error in queryAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get the Aptos provider directly (for advanced usage)
   */
  getProvider(): Aptos {
    return this.provider;
  }

  /**
   * Get the NFT indexer endpoint URL
   */
  getNftIndexerEndpoint(): string {
    return this.nftIndexerEndpoint;
  }

  /**
   * Get the regular indexer endpoint URL
   */
  getIndexerEndpoint(): string {
    return this.indexerEndpoint;
  }

  /**
   * Get the analytics API endpoint URL
   */
  getAnalyticsEndpoint(): string {
    return this.analyticsEndpoint;
  }
} 