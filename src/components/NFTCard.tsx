import React from 'react';
import { Card, Badge, Typography, Tag, Space, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import { NFT } from '../types';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Meta } = Card;
const { Text } = Typography;

interface NFTCardProps {
  nft: NFT;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft }) => {
  const hasIncompleteMetadata = nft.hasCompleteMetadata === false;
  
  return (
    <Badge.Ribbon text={nft.marketplace} color={getMarketplaceColor(nft.marketplace)}>
      <Card
        className="nft-card"
        cover={
          <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden' }}>
            <Link to={`/nft/${nft.id}`}>
              <img 
                alt={nft.name} 
                src={nft.image_url} 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover' 
                }} 
              />
              {hasIncompleteMetadata && (
                <Badge 
                  count={<ExclamationCircleOutlined style={{ color: 'white' }} />} 
                  style={{ 
                    backgroundColor: '#f5222d', 
                    position: 'absolute', 
                    top: 8, 
                    right: 8 
                  }} 
                />
              )}
            </Link>
          </div>
        }
        actions={[
          <div key="price">
            {nft.price ? (
              <Text strong>{`${nft.price.amount} ${nft.price.currency}`}</Text>
            ) : (
              <Text type="secondary">Not for sale</Text>
            )}
          </div>,
        ]}
      >
        <Meta 
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link to={`/nft/${nft.id}`} style={{ marginRight: 8 }}>{nft.name}</Link>
              {hasIncompleteMetadata && (
                <Tooltip title="This NFT has incomplete metadata (missing name, description, or image)">
                  <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
                </Tooltip>
              )}
            </div>
          } 
          description={
            <Space direction="vertical" size="small">
              <Text type="secondary">{`Collection: ${nft.collection_name || 'Unknown'}`}</Text>
              {nft.last_sold_at && (
                <Text type="secondary">
                  Last sold: {new Date(nft.last_sold_at).toLocaleDateString()}
                </Text>
              )}
            </Space>
          } 
        />
      </Card>
    </Badge.Ribbon>
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

export default NFTCard; 