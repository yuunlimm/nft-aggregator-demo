import React, { useState } from 'react';
import { Card, Badge, Typography, Tag, Space, Tooltip, Skeleton } from 'antd';
import { Link } from 'react-router-dom';
import { NFT } from '../types';
import { ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Meta } = Card;
const { Text } = Typography;

interface NFTCardProps {
  nft: NFT;
}

// Safe text display function to prevent XSS
const sanitizeText = (text: string | undefined): string => {
  if (!text) return '';
  
  // Basic sanitization by removing potentially dangerous HTML
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const NFTCard: React.FC<NFTCardProps> = ({ nft }) => {
  const hasIncompleteMetadata = nft.hasCompleteMetadata === false;
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Safely handle NFT name
  const safeName = sanitizeText(nft.name) || 'Unnamed NFT';
  const safeCollectionName = sanitizeText(nft.collection_name) || 'Unknown Collection';
  
  // Verify image URL safety
  const isSafeImageUrl = (url: string): boolean => {
    // Check for common safe image domains and protocols
    return (
      url.startsWith('https://') && 
      !url.includes('javascript:') && 
      !url.includes('data:')
    );
  };
  
  // Get safe image URL or fallback
  const getImageUrl = (): string => {
    if (!nft.image_url) return '/public/fallback-nft.png'; // Fallback image path
    
    return isSafeImageUrl(nft.image_url) 
      ? nft.image_url 
      : '/public/fallback-nft.png'; // Use fallback if URL is suspicious
  };
  
  const handleImageError = () => {
    setImageError(true);
  };
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  return (
    <Badge.Ribbon text={sanitizeText(nft.marketplace)} color={getMarketplaceColor(nft.marketplace)}>
      <Card
        className="nft-card"
        cover={
          <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden' }}>
            <Link to={`/nft/${encodeURIComponent(nft.id)}`}>
              {!imageLoaded && !imageError && (
                <Skeleton.Image 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%'
                  }} 
                  active 
                />
              )}
              
              <img 
                alt={safeName} 
                src={getImageUrl()} 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  display: imageError ? 'none' : 'block'
                }} 
                onError={handleImageError}
                onLoad={handleImageLoad}
                loading="lazy" // Use lazy loading for performance
                referrerPolicy="no-referrer" // Security: Don't send referrer information
              />
              
              {imageError && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f0f0f0'
                  }}
                >
                  <WarningOutlined style={{ fontSize: 32, color: '#999' }} />
                </div>
              )}
              
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
              <Text strong>{`${nft.price.amount} ${sanitizeText(nft.price.currency)}`}</Text>
            ) : (
              <Text type="secondary">Not for sale</Text>
            )}
          </div>,
        ]}
      >
        <Meta 
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link to={`/nft/${encodeURIComponent(nft.id)}`} style={{ marginRight: 8 }}>{safeName}</Link>
              {hasIncompleteMetadata && (
                <Tooltip title="This NFT has incomplete metadata (missing name, description, or image)">
                  <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
                </Tooltip>
              )}
            </div>
          } 
          description={
            <Space direction="vertical" size="small">
              <Text type="secondary">{`Collection: ${safeCollectionName}`}</Text>
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