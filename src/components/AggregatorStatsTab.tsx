import React from 'react';
import { Row, Col, Card, Typography, Spin, Alert, Statistic, Progress, Empty, Divider, Tag, Table } from 'antd';
import { 
  ShopOutlined, 
  AppstoreOutlined, 
  FileImageOutlined, 
  ClockCircleOutlined,
  DollarOutlined,
  DatabaseOutlined 
} from '@ant-design/icons';
import { AggregatorStats } from '../types';

const { Title, Text, Paragraph } = Typography;

interface AggregatorStatsTabProps {
  stats: AggregatorStats | null;
  loading: boolean;
  error: string | null;
}

interface MarketplaceDataItem {
  name: string;
  value: number;
  color: string;
}

const AggregatorStatsTab: React.FC<AggregatorStatsTabProps> = ({ stats, loading, error }) => {
  // Prepare data for marketplace distribution visualization
  const getMarketplaceData = (): MarketplaceDataItem[] => {
    if (!stats || !stats.marketplace_distribution) return [];
    
    return Object.entries(stats.marketplace_distribution).map(([name, percentage], index) => ({
      name,
      value: percentage,
      color: COLORS[index % COLORS.length]
    }));
  };

  // Colors for visualization
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  // Format large numbers with commas
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Create columns for marketplace distribution table
  const marketplaceColumns = [
    {
      title: 'Marketplace',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: MarketplaceDataItem) => (
        <span>
          <Tag color={record.color} style={{ marginRight: 8 }}>
            <DatabaseOutlined style={{ marginRight: 4 }} />
          </Tag>
          {text}
        </span>
      ),
    },
    {
      title: 'Percentage',
      dataIndex: 'value',
      key: 'value',
      render: (value: number) => (
        <div style={{ width: '100%' }}>
          <Progress 
            percent={value} 
            size="small" 
            format={(percent) => `${percent}%`} 
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Loading aggregator statistics...</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Statistics"
        description={error}
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
    <div className="aggregator-stats-tab">
      <Title level={4}>NFT Aggregator Analytics</Title>
      <Paragraph>
        Comprehensive statistics about the NFT ecosystem across all integrated marketplaces.
      </Paragraph>

      <Divider />

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

      {/* Marketplace Distribution Row */}
      {/* <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Marketplace Distribution">
            {Object.keys(stats.marketplace_distribution).length > 0 ? (
              <Table 
                dataSource={getMarketplaceData()}
                columns={marketplaceColumns}
                pagination={false}
                rowKey="name"
              />
            ) : (
              <Empty 
                description="No marketplace distribution data available" 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
              />
            )}
          </Card>
        </Col>
      </Row> */}

      <Divider />

      {/* Marketplace Tags */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Connected Marketplaces">
            {Object.keys(stats.marketplace_distribution).length > 0 ? (
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
                    {/* <span style={{ fontWeight: 'bold' }}>
                      {marketplace.value}%
                    </span> */}
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
        </Col>
      </Row>
    </div>
  );
};

export default AggregatorStatsTab; 