import React, { useState, useEffect } from 'react';
import { Table, Card, Tabs, Typography, Select, Spin, Alert, Avatar, Tag, Pagination, Row, Col, Statistic, Progress, Empty, Divider } from 'antd';
import { 
  fetchCollectionsByVolume, 
  fetchCollectionsBySales, 
  fetchCollectionsByFloorPrice,
  fetchAggregatorStats
} from '../lib/api';
import { Link } from 'react-router-dom';
import { 
  ShopOutlined, 
  AppstoreOutlined, 
  FileImageOutlined, 
  DatabaseOutlined 
} from '@ant-design/icons';
import { AggregatorStats } from '../types';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface MarketplaceDataItem {
  name: string;
  value: number;
  color: string;
}

const CollectionRankings: React.FC = () => {
  // Collections data states
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [floorPriceData, setFloorPriceData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<string>('24h');
  const [activeTab, setActiveTab] = useState<string>('volume');
  
  // Aggregator stats states
  const [stats, setStats] = useState<AggregatorStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [totalItems, setTotalItems] = useState<number>(0);

  // Colors for marketplace visualization
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  // Format large numbers with commas
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Prepare data for marketplace distribution visualization
  const getMarketplaceData = (): MarketplaceDataItem[] => {
    if (!stats || !stats.marketplace_distribution) return [];
    
    return Object.entries(stats.marketplace_distribution).map(([name, percentage], index) => ({
      name,
      value: percentage,
      color: COLORS[index % COLORS.length]
    }));
  };

  // Load aggregator stats
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      
      try {
        const statsData = await fetchAggregatorStats();
        setStats(statsData);
      } catch (error) {
        console.error('Error loading aggregator stats:', error);
        setStatsError(`Failed to load statistics: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, []);

  // Load collection rankings data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Calculate offset for pagination
        const offset = (currentPage - 1) * pageSize;
        
        // Fetch collections based on active tab with server-side pagination
        if (activeTab === 'volume') {
          const collections = await fetchCollectionsByVolume({ 
            timePeriod: timePeriod as any,
            limit: pageSize,
            offset: offset
          });
          setVolumeData(collections);
          
          // In a real implementation, the API would return the total count along with the data
          // For example: const { data, totalCount } = await api.fetchData();
          // Here we're just using the length of the current page as a demo
          // If we have a full page, assume there might be more pages
          if (collections.length >= pageSize) {
            // If we're on the first page and have a full page of results,
            // show pagination for at least one more page
            setTotalItems(Math.max((currentPage * pageSize) + (collections.length === pageSize ? pageSize : 0), collections.length));
          } else if (collections.length === 0 && currentPage > 1) {
            // If no results on a page beyond the first, keep the total but don't increase it
            // This allows going back to previous pages
            setTotalItems((currentPage - 1) * pageSize);
          } else {
            // Otherwise, just use the count from previous pages plus current results
            setTotalItems(((currentPage - 1) * pageSize) + collections.length);
          }
        } else if (activeTab === 'sales') {
          const collections = await fetchCollectionsBySales({ 
            timePeriod: timePeriod as any,
            limit: pageSize,
            offset: offset
          });
          setSalesData(collections);
          
          // Same logic as above for calculating total items
          if (collections.length >= pageSize) {
            setTotalItems(Math.max((currentPage * pageSize) + (collections.length === pageSize ? pageSize : 0), collections.length));
          } else if (collections.length === 0 && currentPage > 1) {
            setTotalItems((currentPage - 1) * pageSize);
          } else {
            setTotalItems(((currentPage - 1) * pageSize) + collections.length);
          }
        } else if (activeTab === 'floor') {
          const collections = await fetchCollectionsByFloorPrice({ 
            timePeriod: timePeriod as any,
            limit: pageSize,
            offset: offset
          });
          setFloorPriceData(collections);
          
          // Same logic as above for calculating total items
          if (collections.length >= pageSize) {
            setTotalItems(Math.max((currentPage * pageSize) + (collections.length === pageSize ? pageSize : 0), collections.length));
          } else if (collections.length === 0 && currentPage > 1) {
            setTotalItems((currentPage - 1) * pageSize);
          } else {
            setTotalItems(((currentPage - 1) * pageSize) + collections.length);
          }
        }
      } catch (error) {
        console.error(`Error fetching collections data:`, error);
        setError(`Failed to load collection rankings: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, timePeriod, currentPage]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setCurrentPage(1); // Reset to first page when changing tabs
  };

  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value);
    setCurrentPage(1); // Reset to first page when changing time period
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get the total number of items for pagination
  const getTotalItems = () => {
    return totalItems;
  };

  // Column definitions for volume ranking
  const volumeColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      render: (_: any, __: any, index: number) => ((currentPage - 1) * pageSize) + index + 1,
      width: 80,
    },
    {
      title: 'Collection',
      dataIndex: 'collection_name',
      key: 'collection_name',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            shape="square" 
            size={40} 
            src={`https://via.placeholder.com/40?text=${encodeURIComponent(text.charAt(0))}`}
            style={{ marginRight: 12 }}
          />
          <Link to={`/collection/${record.collection_id}`}>
            {text}
          </Link>
        </div>
      ),
    },
    {
      title: 'Volume',
      dataIndex: 'total_volume_apt',
      key: 'volume',
      render: (volume: number) => `${volume.toFixed(2)} APT`,
      sorter: (a: any, b: any) => a.total_volume_apt - b.total_volume_apt,
      defaultSortOrder: 'descend' as 'descend',
    },
    {
      title: 'Sales',
      dataIndex: 'total_sales',
      key: 'sales',
      sorter: (a: any, b: any) => a.total_sales - b.total_sales,
    }
  ];

  // Column definitions for sales ranking
  const salesColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      render: (_: any, __: any, index: number) => ((currentPage - 1) * pageSize) + index + 1,
      width: 80,
    },
    {
      title: 'Collection',
      dataIndex: 'collection_name',
      key: 'collection_name',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            shape="square" 
            size={40} 
            src={`https://via.placeholder.com/40?text=${encodeURIComponent(text.charAt(0))}`}
            style={{ marginRight: 12 }}
          />
          <Link to={`/collection/${record.collection_id}`}>
            {text}
          </Link>
        </div>
      ),
    },
    {
      title: 'Sales',
      dataIndex: 'total_sales',
      key: 'sales',
      sorter: (a: any, b: any) => a.total_sales - b.total_sales,
      defaultSortOrder: 'descend' as 'descend',
    },
    {
      title: 'Volume',
      dataIndex: 'total_volume_apt',
      key: 'volume',
      render: (volume: number) => `${volume.toFixed(2)} APT`,
      sorter: (a: any, b: any) => a.total_volume_apt - b.total_volume_apt,
    }
  ];

  // Column definitions for floor price ranking
  const floorPriceColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      render: (_: any, __: any, index: number) => ((currentPage - 1) * pageSize) + index + 1,
      width: 80,
    },
    {
      title: 'Collection',
      dataIndex: 'collection_name',
      key: 'collection_name',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            shape="square" 
            size={40} 
            src={`https://via.placeholder.com/40?text=${encodeURIComponent(text.charAt(0))}`}
            style={{ marginRight: 12 }}
          />
          <Link to={`/collection/${record.collection_id}`}>
            {text}
          </Link>
        </div>
      ),
    },
    {
      title: 'Floor Price',
      dataIndex: 'floor_price_apt',
      key: 'floor_price',
      render: (price: number) => `${price.toFixed(2)} APT`,
      sorter: (a: any, b: any) => a.floor_price_apt - b.floor_price_apt,
      defaultSortOrder: 'descend' as 'descend',
    },
    {
      title: 'Volume',
      dataIndex: 'total_volume_apt',
      key: 'volume',
      render: (volume: number) => volume ? `${volume.toFixed(2)} APT` : '-',
      sorter: (a: any, b: any) => (a.total_volume_apt || 0) - (b.total_volume_apt || 0),
    }
  ];

  // Render aggregator stats section
  const renderAggregatorStats = () => {
    if (statsLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>Loading aggregator statistics...</Text>
          </div>
        </div>
      );
    }

    if (statsError) {
      return (
        <Alert
          message="Error Loading Statistics"
          description={statsError}
          type="error"
          showIcon
        />
      );
    }

    if (!stats) {
      return (
        <Empty 
          description="No aggregator statistics available" 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      );
    }

    return (
      <div className="aggregator-stats">
        <div style={{ marginBottom: 16 }}>
          <Title level={4}>NFT Aggregator Analytics</Title>
          <Paragraph>
            Comprehensive statistics about the NFT ecosystem across all integrated marketplaces.
          </Paragraph>
        </div>

        {/* Main Statistics Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {stats.total_nfts !== undefined && (
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic 
                  title="Total NFTs" 
                  value={stats.total_nfts} 
                  formatter={(value) => formatNumber(value as number)}
                  prefix={<FileImageOutlined />}
                />
                <Progress 
                  percent={Math.min(100, (stats.total_nfts / 10000) * 100)} 
                  showInfo={false} 
                  status="active"
                  strokeColor="#1890ff"
                />
              </Card>
            </Col>
          )}
          {stats.total_collections !== undefined && (
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic 
                  title="Total Collections" 
                  value={stats.total_collections} 
                  formatter={(value) => formatNumber(value as number)}
                  prefix={<AppstoreOutlined />}
                />
                <Progress 
                  percent={Math.min(100, (stats.total_collections / 1000) * 100)} 
                  showInfo={false} 
                  status="active"
                  strokeColor="#52c41a"
                />
              </Card>
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic 
                title="Active Listings" 
                value={stats.total_active_listings || 0} 
                formatter={(value) => formatNumber(value as number)}
                prefix={<ShopOutlined />}
              />
              <Progress 
                percent={Math.min(100, ((stats.total_active_listings || 0) / 5000) * 100)} 
                showInfo={false} 
                status="active"
                strokeColor="#fa8c16"
              />
            </Card>
          </Col>
        </Row>

        {/* Marketplace Tags */}
        <Card title="Connected Marketplaces">
          {stats.marketplace_distribution && Object.keys(stats.marketplace_distribution).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {getMarketplaceData().map((marketplace) => (
                <div 
                  key={marketplace.name}
                  style={{ 
                    padding: '12px 20px', 
                    borderRadius: '4px', 
                    background: marketplace.color, 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <DatabaseOutlined />
                  <span>{marketplace.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty 
              description="No marketplace data available" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>

        <Divider />
      </div>
    );
  };

  return (
    <Card style={{ marginBottom: 24 }}>
      {/* Aggregator Stats Section */}
      {renderAggregatorStats()}

      {/* Collection Rankings Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Collection Rankings</Title>
        <Select
          style={{ width: 120 }}
          value={timePeriod}
          onChange={handleTimePeriodChange}
        >
          <Option value="1h">1 Hour</Option>
          <Option value="6h">6 Hours</Option>
          <Option value="24h">24 Hours</Option>
          <Option value="7d">7 Days</Option>
          <Option value="30d">30 Days</Option>
        </Select>
      </div>

      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="Volume" key="volume">
          {error ? (
            <Alert
              message="Error Loading Data"
              description={error}
              type="error"
              showIcon
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              {volumeData.length > 0 ? (
                <>
                  <Table 
                    dataSource={volumeData} 
                    columns={volumeColumns} 
                    rowKey="collection_id"
                    pagination={false}
                    size="middle"
                  />
                  <Row justify="center" style={{ marginTop: 16 }}>
                    <Pagination
                      current={currentPage}
                      onChange={handlePageChange}
                      total={getTotalItems()}
                      pageSize={pageSize}
                      showSizeChanger={false}
                      hideOnSinglePage={true}
                      showLessItems={true}
                    />
                  </Row>
                </>
              ) : !loading && (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <Avatar shape="square" size={64} src={`/empty-box.svg`} />
                  </div>
                  <p>No data available for this page</p>
                  {currentPage > 1 && (
                    <button 
                      onClick={() => setCurrentPage(1)} 
                      style={{ 
                        border: 'none', 
                        background: 'transparent', 
                        color: '#1890ff', 
                        cursor: 'pointer' 
                      }}
                    >
                      Back to first page
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </TabPane>
        <TabPane tab="Sales" key="sales">
          {error ? (
            <Alert
              message="Error Loading Data"
              description={error}
              type="error"
              showIcon
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              {salesData.length > 0 ? (
                <>
                  <Table 
                    dataSource={salesData} 
                    columns={salesColumns} 
                    rowKey="collection_id"
                    pagination={false}
                    size="middle"
                  />
                  <Row justify="center" style={{ marginTop: 16 }}>
                    <Pagination
                      current={currentPage}
                      onChange={handlePageChange}
                      total={getTotalItems()}
                      pageSize={pageSize}
                      showSizeChanger={false}
                      hideOnSinglePage={true}
                      showLessItems={true}
                    />
                  </Row>
                </>
              ) : !loading && (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <Avatar shape="square" size={64} src={`/empty-box.svg`} />
                  </div>
                  <p>No data available for this page</p>
                  {currentPage > 1 && (
                    <button 
                      onClick={() => setCurrentPage(1)} 
                      style={{ 
                        border: 'none', 
                        background: 'transparent', 
                        color: '#1890ff', 
                        cursor: 'pointer' 
                      }}
                    >
                      Back to first page
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </TabPane>
        <TabPane tab="Floor Price" key="floor">
          {error ? (
            <Alert
              message="Error Loading Data"
              description={error}
              type="error"
              showIcon
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              {floorPriceData.length > 0 ? (
                <>
                  <Table 
                    dataSource={floorPriceData} 
                    columns={floorPriceColumns} 
                    rowKey="collection_id"
                    pagination={false}
                    size="middle"
                  />
                  <Row justify="center" style={{ marginTop: 16 }}>
                    <Pagination
                      current={currentPage}
                      onChange={handlePageChange}
                      total={getTotalItems()}
                      pageSize={pageSize}
                      showSizeChanger={false}
                      hideOnSinglePage={true}
                      showLessItems={true}
                    />
                  </Row>
                </>
              ) : !loading && (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <Avatar shape="square" size={64} src={`/empty-box.svg`} />
                  </div>
                  <p>No data available for this page</p>
                  {currentPage > 1 && (
                    <button 
                      onClick={() => setCurrentPage(1)} 
                      style={{ 
                        border: 'none', 
                        background: 'transparent', 
                        color: '#1890ff', 
                        cursor: 'pointer' 
                      }}
                    >
                      Back to first page
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default CollectionRankings; 