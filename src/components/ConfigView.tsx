import React, { useState, useEffect } from 'react';
import { Card, List, Avatar, Button, Switch, Input, Modal, Typography, Tag, Spin, Space, message } from 'antd';
import { fetchMarketplaceConfigs, connectMarketplace, disconnectMarketplace } from '../lib/api';
import { MarketplaceConfig } from '../types';

const { Title, Text, Paragraph } = Typography;

const ConfigView: React.FC = () => {
  const [marketplaces, setMarketplaces] = useState<MarketplaceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    const loadMarketplaces = async () => {
      setLoading(true);
      try {
        const data = await fetchMarketplaceConfigs();
        setMarketplaces(data);
      } catch (error) {
        message.error('Failed to load marketplace configurations');
      } finally {
        setLoading(false);
      }
    };

    loadMarketplaces();
  }, []);

  const handleConnectClick = (marketplace: MarketplaceConfig) => {
    setSelectedMarketplace(marketplace);
    setApiKey(marketplace.api_key || '');
    setIsModalVisible(true);
  };

  const handleDisconnectClick = async (marketplace: MarketplaceConfig) => {
    try {
      await disconnectMarketplace(marketplace.id);
      
      // Update the local state
      setMarketplaces(marketplaces.map(m => 
        m.id === marketplace.id ? { ...m, is_connected: false, api_key: undefined } : m
      ));
      
      message.success(`Disconnected from ${marketplace.name}`);
    } catch (error) {
      message.error(`Failed to disconnect from ${marketplace.name}`);
    }
  };

  const handleModalOk = async () => {
    if (!selectedMarketplace) return;
    
    setConnectLoading(true);
    try {
      await connectMarketplace(selectedMarketplace.id, apiKey);
      
      // Update the local state
      setMarketplaces(marketplaces.map(m => 
        m.id === selectedMarketplace.id ? { ...m, is_connected: true, api_key: apiKey } : m
      ));
      
      message.success(`Connected to ${selectedMarketplace.name}`);
      setIsModalVisible(false);
    } catch (error) {
      message.error(`Failed to connect to ${selectedMarketplace.name}`);
    } finally {
      setConnectLoading(false);
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setSelectedMarketplace(null);
    setApiKey('');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>Marketplace Configuration</Title>
      <Paragraph>
        Connect to various NFT marketplaces to aggregate your NFTs in one place.
      </Paragraph>
      
      <List
        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
        dataSource={marketplaces}
        renderItem={(marketplace) => (
          <List.Item>
            <Card>
              <Card.Meta
                avatar={<Avatar src={marketplace.logo_url} size={64} />}
                title={
                  <Space>
                    {marketplace.name}
                    {marketplace.is_connected ? (
                      <Tag color="success">Connected</Tag>
                    ) : (
                      <Tag color="default">Disconnected</Tag>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical">
                    <Text>{marketplace.website_url}</Text>
                    <Text>
                      Supported chains: {marketplace.supported_chains.join(', ')}
                    </Text>
                    {marketplace.last_synced_at && (
                      <Text type="secondary">
                        Last synced: {new Date(marketplace.last_synced_at).toLocaleString()}
                      </Text>
                    )}
                  </Space>
                }
              />
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                {marketplace.is_connected ? (
                  <Button onClick={() => handleDisconnectClick(marketplace)}>
                    Disconnect
                  </Button>
                ) : (
                  <Button type="primary" onClick={() => handleConnectClick(marketplace)}>
                    Connect
                  </Button>
                )}
              </div>
            </Card>
          </List.Item>
        )}
      />
      
      <Modal
        title={`Connect to ${selectedMarketplace?.name}`}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={connectLoading}
      >
        <Paragraph>
          Enter your API key to connect to {selectedMarketplace?.name}.
        </Paragraph>
        <Input
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  );
};

export default ConfigView; 