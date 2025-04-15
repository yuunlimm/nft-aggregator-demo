import React, { useState, useEffect } from 'react';
import { Button, Dropdown, Space, Menu, Typography, Modal, List, Tag } from 'antd';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { DownOutlined, DisconnectOutlined, LinkOutlined, InfoCircleOutlined } from '@ant-design/icons';
// Import the wallet adapters array from index.tsx
import { walletAdapters } from '../index';

const { Text, Title, Paragraph } = Typography;

interface ExtendedWalletState {
  account: any;
  connected: boolean;
  network: any;
  wallet: any;
  wallets: any[];
  isLoading?: boolean;
  connecting?: boolean;
  disconnecting?: boolean;
  disconnect: () => Promise<void>;
  connect: (name: string) => Promise<void>;
}

const CustomWalletConnector: React.FC = () => {
  // Cast wallet state for TypeScript compatibility
  const walletState = useWallet() as unknown as ExtendedWalletState;
  const { 
    account, 
    connected, 
    wallet, 
    wallets = [], 
    connect, 
    disconnect,
    connecting
  } = walletState;

  const [hasLogged, setHasLogged] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Get configured wallet names from the walletAdapters array
  const configuredWalletNames = walletAdapters.map(adapter => adapter.name);
  
  // Log wallet info on mount for debugging
  useEffect(() => {
    if (!hasLogged) {
      // Create detailed report of available wallets
      const walletDetails = wallets.map((w: any) => ({
        name: w.name,
        url: w.url,
        icon: w.icon ? 'Has icon' : 'No icon',
        isConfigured: configuredWalletNames.includes(w.name)
      }));
      
      console.log('CustomWalletConnector - Available wallets detected:', walletDetails);
      
      // Log names for easier reference
      const walletNames = wallets.map((w: any) => w.name).join(', ');
      console.log('All detected wallet names:', walletNames);
      
      // Log names of configured wallets
      const configuredWallets = wallets.filter((w: any) => configuredWalletNames.includes(w.name));
      console.log('Configured wallets:', configuredWallets.map((w: any) => w.name).join(', '));
      
      setHasLogged(true);
    }
  }, [wallets, wallet, connected, hasLogged, configuredWalletNames]);

  const handleConnectWallet = (walletName: string) => {
    console.log(`Attempting to connect to wallet: ${walletName}`);
    connect(walletName).catch(err => {
      console.error(`Error connecting to ${walletName}:`, err);
    });
  };

  const handleDisconnect = () => {
    console.log('Disconnecting wallet');
    disconnect().catch(err => {
      console.error('Error disconnecting:', err);
    });
  };

  const showWalletInfoModal = () => {
    setIsModalVisible(true);
  };

  // Get unique wallet instances by name
  const getUniqueWallets = (walletList: any[]) => {
    const uniqueWallets: any[] = [];
    const walletMap = new Map();
    
    walletList.forEach(wallet => {
      if (!walletMap.has(wallet.name)) {
        walletMap.set(wallet.name, true);
        uniqueWallets.push(wallet);
      }
    });
    
    return uniqueWallets;
  };

  // Wallet information modal to help debugging
  const WalletInfoModal = () => {
    // Get unique wallets that are configured
    const uniqueConfiguredWallets = getUniqueWallets(
      wallets.filter((w: any) => configuredWalletNames.includes(w.name))
    );
    
    return (
      <Modal
        title="Wallet Information"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={700}
      >
        <Paragraph>
          <Text strong>Configured Wallets:</Text> These wallets are specifically included in the application.
        </Paragraph>
        
        <List
          bordered
          dataSource={uniqueConfiguredWallets}
          renderItem={(w: any) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    {w.name}
                    <Tag color="green">Configured</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical">
                    <Text>URL: {w.url || 'Not provided'}</Text>
                    <Text>Icon: {w.icon ? 'Available' : 'Not available'}</Text>
                    <Text>Status: {wallet?.name === w.name ? 'Connected' : 'Not connected'}</Text>
                  </Space>
                }
              />
              <Button 
                type={wallet?.name === w.name ? 'primary' : 'default'}
                onClick={() => handleConnectWallet(w.name)}
              >
                Connect
              </Button>
            </List.Item>
          )}
        />
        
        <Paragraph style={{ marginTop: '16px' }}>
          <Text type="secondary">Other detected wallets are not shown because they're not configured in the application.</Text>
        </Paragraph>
      </Modal>
    );
  };

  // If not connected, show connect dropdown with only configured wallets
  if (!connected) {
    // Get unique wallet instances that are configured
    const uniqueConfiguredWallets = getUniqueWallets(
      wallets.filter((w: any) => configuredWalletNames.includes(w.name))
    );
    
    const items = uniqueConfiguredWallets.map((w: any) => ({
      key: w.name,
      label: (
        <div onClick={() => handleConnectWallet(w.name)} style={{ display: 'flex', alignItems: 'center' }}>
          {w.icon && <img src={w.icon} alt={w.name} style={{ width: 20, height: 20, marginRight: 8 }} />}
          {w.name}
        </div>
      )
    }));

    // Add an item to show wallet info
    items.push({
      key: 'wallet-info',
      label: (
        <div onClick={showWalletInfoModal} style={{ display: 'flex', alignItems: 'center' }}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          Wallet Info
        </div>
      )
    });

    return (
      <>
        <Space wrap>
          {connecting ? (
            <Button loading>Connecting...</Button>
          ) : uniqueConfiguredWallets.length === 0 ? (
            <Button type="primary" danger icon={<DisconnectOutlined />}>
              No Wallets Found
            </Button>
          ) : (
            <Dropdown 
              menu={{ items }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button type="primary" icon={<LinkOutlined />}>
                <Space>
                  Connect Wallet
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          )}
        </Space>
        <WalletInfoModal />
      </>
    );
  }

  // If connected, show address and disconnect button
  return (
    <>
      <Space>
        <Text style={{ color: 'white' }}>
          {account?.address.slice(0, 6)}...{account?.address.slice(-4)}
        </Text>
        <Button 
          type="primary" 
          danger
          icon={<DisconnectOutlined />} 
          onClick={handleDisconnect}
        >
          Disconnect
        </Button>
        <Button 
          type="link" 
          icon={<InfoCircleOutlined />} 
          onClick={showWalletInfoModal}
          style={{ color: 'white' }}
        />
      </Space>
      <WalletInfoModal />
    </>
  );
};

export default CustomWalletConnector;