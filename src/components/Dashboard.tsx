import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Select, Input, Typography, Spin, Statistic, Empty, Pagination, Alert, Tabs, Switch, Button } from 'antd';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { fetchNFTs, fetchMarketplaceConfigs, fetchAggregatorStats, fetchActiveListings, invalidateListingsCache } from '../lib/api';
import { NFT, MarketplaceConfig, AggregatorStats } from '../types';
import NFTCard from './NFTCard';
import { ShopOutlined, WalletOutlined, AppstoreOutlined, PieChartOutlined, InfoCircleOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import AggregatorStatsTab from './AggregatorStatsTab';
import CollectionRankings from './CollectionRankings';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { TabPane } = Tabs;

// Helper to get query parameters from URL
function useQueryParams() {
  const location = useLocation();
  return new URLSearchParams(location.search);
}

// Helper to build a new URL with updated query parameters
function buildUrlWithParams(navigate: any, params: Record<string, string | null>) {
  const searchParams = new URLSearchParams(window.location.search);
  
  // Update or remove each parameter
  Object.entries(params).forEach(([key, value]) => {
    if (value === null) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  });
  
  // Build the new URL
  const newSearch = searchParams.toString();
  const newPath = newSearch ? `?${newSearch}` : '';
  navigate(newPath, { replace: true });
}

const Dashboard: React.FC = () => {
  const { account } = useWallet();
  const navigate = useNavigate();
  const queryParams = useQueryParams();
  
  // Get initial values from URL query parameters
  const initialMarketplace = queryParams.get('marketplace') || '';
  const initialCollection = queryParams.get('collection') || '';
  const initialPage = parseInt(queryParams.get('page') || '1', 10);
  const initialTab = queryParams.get('tab') || 'listings';
  const initialSort = queryParams.get('sort') || 'timestamp_desc';
  const initialHideIncomplete = queryParams.get('hideIncomplete') === 'true';
  
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [listings, setListings] = useState<NFT[]>([]);
  const [marketplaces, setMarketplaces] = useState<MarketplaceConfig[]>([]);
  const [stats, setStats] = useState<AggregatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>(initialMarketplace);
  const [searchCollection, setSearchCollection] = useState<string>(initialCollection);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [listingsPage, setListingsPage] = useState(initialPage);
  const [sortOrder, setSortOrder] = useState<string>(initialSort);
  const [total, setTotal] = useState(0);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hideIncompleteMetadata, setHideIncompleteMetadata] = useState<boolean>(initialHideIncomplete);
  const pageSize = 8;
  const [refreshing, setRefreshing] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params: Record<string, string | null> = {
      tab: activeTab,
      sort: sortOrder,
      hideIncomplete: hideIncompleteMetadata ? 'true' : null
    };
    
    if (selectedMarketplace) {
      params.marketplace = selectedMarketplace;
    } else {
      params.marketplace = null;
    }
    
    if (searchCollection) {
      params.collection = searchCollection;
    } else {
      params.collection = null;
    }
    
    if (activeTab === 'listings') {
      params.page = listingsPage.toString();
    } else if (activeTab === 'my-nfts') {
      params.page = currentPage.toString();
    }
    
    buildUrlWithParams(navigate, params);
  }, [selectedMarketplace, searchCollection, listingsPage, currentPage, activeTab, sortOrder, hideIncompleteMetadata, navigate]);

  // Load active listings
  useEffect(() => {
    const loadListings = async () => {
      setListingsLoading(true);
      setListingsError(null);
      try {
        const result = await fetchActiveListings({
          page: listingsPage,
          pageSize,
          marketplace: selectedMarketplace || undefined,
          collection: searchCollection || undefined,
          sortOrder: sortOrder,
          hideIncompleteMetadata: hideIncompleteMetadata,
          skipCache: false
        });
        
        // If we get an empty result due to API errors, just show empty UI
        setListings(result.nfts);
        setListingsTotal(result.total);
        
        // Only show error if we explicitly have an error message
        if (result.nfts.length === 0 && result.total === 0) {
          setListingsError("No listings found. The API may be unavailable currently.");
        }
      } catch (error) {
        console.error('Error loading listings:', error);
        setListingsError(`Failed to load listings: ${error instanceof Error ? error.message : String(error)}`);
        setListings([]);
        setListingsTotal(0);
      } finally {
        setListingsLoading(false);
        setRefreshing(false);
      }
    };

    // Only load listings when the listings tab is active or on initial load
    if (activeTab === 'listings') {
      loadListings();
    }
  }, [selectedMarketplace, searchCollection, listingsPage, activeTab, sortOrder, hideIncompleteMetadata, refreshing]);

  // Load owned NFTs when wallet is connected
  useEffect(() => {
    const loadWalletNFTs = async () => {
      setLoading(true);
      setError(null);
      try {
        // Only fetch wallet NFTs when the wallet is connected and my-nfts tab is active
        if (account?.address && activeTab === 'my-nfts') {
          const result = await fetchNFTs({
            address: account.address,
            page: currentPage,
            pageSize,
            marketplace: selectedMarketplace || undefined,
            collection: searchCollection || undefined,
            sortOrder: sortOrder
          });
          
          setNfts(result.nfts);
          setTotal(result.total);
          
          // Only show error if we explicitly have an error message
          if (result.nfts.length === 0 && result.total === 0) {
            setError("No NFTs found. The API may be unavailable currently.");
          }
        }
      } catch (error) {
        console.error('Error loading wallet NFTs:', error);
        setError(`Failed to load your NFTs: ${error instanceof Error ? error.message : String(error)}`);
        setNfts([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadWalletNFTs();
  }, [account, selectedMarketplace, searchCollection, currentPage, activeTab, sortOrder]);

  // Load marketplace configurations and aggregator stats
  useEffect(() => {
    const loadConfigAndStats = async () => {
      setStatsError(null);
      setStatsLoading(true);
      
      try {
        // Get marketplace configs
        try {
          const marketplaceData = await fetchMarketplaceConfigs();
          setMarketplaces(marketplaceData);
          
          // If no marketplace data, show a warning
          if (marketplaceData.length === 0) {
            console.warn('No marketplace data returned from API');
          }
        } catch (error) {
          console.error('Error loading marketplace configs:', error);
          setMarketplaces([]);
        }

        // Get aggregator stats
        try {
          const statsData = await fetchAggregatorStats();
          setStats(statsData);
          
          // Check if we got empty stats
          if (statsData.total_nfts === 0 && 
              statsData.total_collections === 0 && 
              statsData.total_marketplaces === 0) {
            console.warn('Empty stats data returned from API');
            
            // If both marketplace configs and stats are empty, show a message
            if (marketplaces.length === 0) {
              setStatsError("API data unavailable. Please try again later.");
            }
          }
        } catch (error) {
          console.error('Error loading aggregator stats:', error);
          setStats({
            total_nfts: 0,
            total_collections: 0,
            total_marketplaces: 0,
            total_active_listings: 0,
            total_value_usd: 0,
            marketplace_distribution: {},
          });
          
          // If we have no marketplaces and stats failed, show an error
          if (marketplaces.length === 0) {
            setStatsError("API data unavailable. Please try again later.");
          }
        }
      } catch (error) {
        console.error('Error loading configurations and stats:', error);
        setStatsError(`Failed to load marketplace data: ${error instanceof Error ? error.message : String(error)}`);
        setMarketplaces([]);
        setStats({
          total_nfts: 0,
          total_collections: 0,
          total_marketplaces: 0,
          total_active_listings: 0,
          total_value_usd: 0,
          marketplace_distribution: {},
        });
      } finally {
        setStatsLoading(false);
      }
    };

    loadConfigAndStats();
  }, []);

  const handleMarketplaceChange = (value: string) => {
    console.log("Selected marketplace value:", value);
    // If the value includes comma-separated values, use as is
    setSelectedMarketplace(value || '');
    setCurrentPage(1);
    setListingsPage(1);
  };

  const handleSearch = (value: string) => {
    setSearchCollection(value);
    setCurrentPage(1);
    setListingsPage(1);
  };

  const handlePageChange = (page: number) => {
    if (activeTab === 'my-nfts') {
      setCurrentPage(page);
    } else {
      setListingsPage(page);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  // Handle sort change
  const handleSortChange = (value: string) => {
    console.log("Selected sort order:", value);
    setSortOrder(value);
    setListingsPage(1); // Reset to first page when changing sort order
  };

  // Handle toggle for incomplete metadata
  const handleIncompleteMetadataToggle = (checked: boolean) => {
    setHideIncompleteMetadata(checked);
    setListingsPage(1); // Reset to first page when changing filter
  };

  // Handle manual refresh
  const handleRefresh = () => {
    if (activeTab === 'listings') {
      // Invalidate cache for current parameters
      invalidateListingsCache({
        page: listingsPage,
        pageSize,
        marketplace: selectedMarketplace || undefined,
        collection: searchCollection || undefined,
        sortOrder: sortOrder,
        hideIncompleteMetadata: hideIncompleteMetadata
      });
      // Trigger refresh
      setRefreshing(true);
    } else if (activeTab === 'my-nfts' && account?.address) {
      // For wallet NFTs, just trigger a re-fetch
      setCurrentPage(currentPage);
    }
  };

  return (
    <div className="dashboard-container">
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Title level={2}>NFT Aggregator</Title>
        </Col>
      </Row>

      {/* Stats cards */}
      {activeTab !== 'stats' && activeTab !== 'rankings' && (
        <Row gutter={[24, 24]} className="stat-cards">
          {stats?.total_nfts !== undefined && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card>
                <Statistic 
                  title="NFTs Indexed" 
                  value={stats?.total_nfts || 0} 
                  loading={statsLoading}
                  prefix={<AppstoreOutlined />}
                />
              </Card>
            </Col>
          )}
          {stats?.total_collections !== undefined && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card>
                <Statistic 
                  title="Collections" 
                  value={stats?.total_collections || 0} 
                  loading={statsLoading}
                  prefix={<AppstoreOutlined />}
                />
              </Card>
            </Col>
          )}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic 
                title="Marketplaces" 
                value={stats?.total_marketplaces || 0} 
                loading={statsLoading}
                prefix={<ShopOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic 
                title="Active Listings" 
                value={stats?.total_active_listings || 0} 
                loading={statsLoading}
                prefix={<PieChartOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {statsError && (
        <Alert 
          message="API Data Issue" 
          description={statsError} 
          type="warning" 
          showIcon 
          closable 
          style={{ marginBottom: 24 }}
        />
      )}
      
      {/* Tabs for different views */}
      <Tabs 
        activeKey={activeTab} 
        onChange={handleTabChange}
        className="dashboard-tabs"
        tabPosition="top"
        type="card"
        destroyInactiveTabPane
      >
        <TabPane 
          tab={<span><ShopOutlined />Marketplace Listings</span>} 
          key="listings"
        >
          {/* Add filters section with refresh button - only for listings tab */}
          <Card className="filter-card" style={{ marginBottom: 24 }}>
            <Row align="middle" gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Filter by Marketplace"
                  style={{ width: '100%' }}
                  value={selectedMarketplace || undefined}
                  onChange={handleMarketplaceChange}
                  allowClear
                >
                  {marketplaces.map((marketplace) => (
                    <Option key={marketplace.id} value={marketplace.rawValues || marketplace.name.toLowerCase()}>
                      {marketplace.name}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Search 
                  placeholder="Search by collection" 
                  onSearch={handleSearch} 
                  defaultValue={searchCollection}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Sort By"
                  style={{ width: '100%' }}
                  value={sortOrder}
                  onChange={handleSortChange}
                >
                  <Option value="timestamp_desc">Newest First</Option>
                  <Option value="timestamp_asc">Oldest First</Option>
                  <Option value="price_desc">Price: High to Low</Option>
                  <Option value="price_asc">Price: Low to High</Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Switch 
                    checked={hideIncompleteMetadata} 
                    onChange={handleIncompleteMetadataToggle}
                    size="small"
                  />
                  <span style={{ marginLeft: 8 }}>Hide Incomplete</span>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                  loading={listingsLoading && refreshing}
                  type="primary"
                  ghost
                >
                  Refresh
                </Button>
              </Col>
            </Row>
          </Card>

          <div className="tab-content-container">
            {/* Marketplace Listings */}
            {listingsLoading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : listingsError ? (
              <Alert
                message="API Unavailable"
                description={listingsError}
                type="warning"
                showIcon
              />
            ) : listings.length > 0 ? (
              <>
                <Row gutter={[16, 16]}>
                  {listings.map((nft) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={nft.id}>
                      <NFTCard nft={nft} />
                    </Col>
                  ))}
                </Row>
                {listingsTotal > pageSize && (
                  <Row justify="center" style={{ marginTop: 24 }}>
                    <Pagination
                      current={listingsPage}
                      total={listingsTotal}
                      pageSize={pageSize}
                      onChange={handlePageChange}
                      showSizeChanger={false}
                    />
                  </Row>
                )}
              </>
            ) : (
              <Empty 
                description={
                  <Text>
                    No active listings found. Try adjusting your filters or check again later.
                  </Text>
                } 
              />
            )}
          </div>
        </TabPane>

        <TabPane 
          tab={<span><WalletOutlined />My NFTs</span>} 
          key="my-nfts"
        >
          {/* Add filter card for My NFTs tab too */}
          <Card className="filter-card" style={{ marginBottom: 24 }}>
            <Row align="middle" gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Filter by Marketplace"
                  style={{ width: '100%' }}
                  value={selectedMarketplace || undefined}
                  onChange={handleMarketplaceChange}
                  allowClear
                >
                  {marketplaces.map((marketplace) => (
                    <Option key={marketplace.id} value={marketplace.rawValues || marketplace.name.toLowerCase()}>
                      {marketplace.name}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Search 
                  placeholder="Search by collection" 
                  onSearch={handleSearch} 
                  defaultValue={searchCollection}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  placeholder="Sort By"
                  style={{ width: '100%' }}
                  value={sortOrder}
                  onChange={handleSortChange}
                >
                  <Option value="timestamp_desc">Newest First</Option>
                  <Option value="timestamp_asc">Oldest First</Option>
                  <Option value="version_desc">Latest Version First</Option>
                  <Option value="version_asc">Earliest Version First</Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                  loading={loading && refreshing}
                  type="primary"
                  ghost
                >
                  Refresh
                </Button>
              </Col>
            </Row>
          </Card>

          <div className="tab-content-container">
            {/* Wallet-owned NFTs */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : error ? (
              <Alert
                message="API Unavailable"
                description={error}
                type="warning"
                showIcon
              />
            ) : nfts.length > 0 ? (
              <>
                <Row gutter={[16, 16]}>
                  {nfts.map((nft) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={nft.id}>
                      <NFTCard nft={nft} />
                    </Col>
                  ))}
                </Row>
                <Row justify="center" style={{ marginTop: 24 }}>
                  <Pagination
                    current={currentPage}
                    total={total}
                    pageSize={pageSize}
                    onChange={handlePageChange}
                    showSizeChanger={false}
                  />
                </Row>
              </>
            ) : account ? (
              <Empty 
                description={
                  <Text>
                    No NFTs found in your wallet. Try adjusting your filters or check again later.
                  </Text>
                } 
              />
            ) : (
              <Empty 
                description={
                  <Text>
                    Connect your wallet to see your NFTs.
                  </Text>
                } 
              />
            )}
          </div>
        </TabPane>

        {/* Analytics tab */}
        <TabPane 
          tab={<span><TrophyOutlined />Analytics</span>} 
          key="analytics"
        >
          <CollectionRankings />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Dashboard; 