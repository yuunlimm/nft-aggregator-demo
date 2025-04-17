import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Typography, Descriptions, Tag, Spin, Button, Table, Empty, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { fetchNFTDetails } from '../lib/api';
import { NFT } from '../types';

const { Title, Text } = Typography;

const NFTDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [nft, setNft] = useState<NFT | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNFTDetails = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const data = await fetchNFTDetails(id);
        
        if (data) {
          setNft(data);
        } else {
          message.error('NFT not found');
        }
      } catch (error) {
        console.error('Failed to load NFT details:', error);
        message.error('Failed to load NFT details');
      } finally {
        setLoading(false);
      }
    };

    loadNFTDetails();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!nft) {
    return (
      <div>
        <Link to="/">
          <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
            Back to Dashboard
          </Button>
        </Link>
        <Empty description="NFT not found" />
      </div>
    );
  }

  // Generate property data for the table
  const propertyData = nft.token_properties 
    ? Object.entries(nft.token_properties).map(([key, value]) => ({
        key,
        trait: key,
        value
      }))
    : [];

  return (
    <div>
      <Link to="/">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Back to Dashboard
        </Button>
      </Link>
      
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <img 
            src={nft.image_url} 
            alt={nft.name}
            className="nft-detail-image"
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} md={12}>
          <Card>
            <Title level={2}>{nft.name}</Title>
            <Tag color={getMarketplaceColor(nft.marketplace)}>{nft.marketplace}</Tag>
            
            {nft.description && (
              <Text style={{ display: 'block', margin: '16px 0' }}>
                {nft.description}
              </Text>
            )}
            
            <Descriptions column={1} bordered style={{ marginTop: 16 }}>
              <Descriptions.Item label="Collection">{nft.collection_name}</Descriptions.Item>
              <Descriptions.Item label="Seller">{nft.owner_address}</Descriptions.Item>
              {nft.price && (
                <Descriptions.Item label="Price">
                  {`${nft.price.amount} ${nft.price.currency}`}
                </Descriptions.Item>
              )}
              {nft.last_sold_at && (
                <Descriptions.Item label="Last Sold">
                  {new Date(nft.last_sold_at).toLocaleString()}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Listed">
                {new Date(nft.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      
      {propertyData.length > 0 && (
        <Card title="Properties" style={{ marginTop: 24 }}>
          <Table 
            dataSource={propertyData}
            columns={[
              {
                title: 'Trait',
                dataIndex: 'trait',
                key: 'trait',
              },
              {
                title: 'Value',
                dataIndex: 'value',
                key: 'value',
              }
            ]}
            pagination={false}
          />
        </Card>
      )}
    </div>
  );
};

// Helper function to get color for different marketplaces
function getMarketplaceColor(marketplace: string): string {
  const colors: Record<string, string> = {
    'OpenSea': 'blue',
    'Magic Eden': 'purple',
    'Blur': 'black',
    'Topaz': 'green',
    'Souffl3': 'orange'
  };
  
  return colors[marketplace] || 'blue';
}

export default NFTDetail; 