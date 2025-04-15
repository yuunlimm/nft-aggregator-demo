import React, { useState, useEffect } from 'react';
import { Button, Dropdown, Space, Typography, Modal, List, Tag, message, Alert } from 'antd';
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
  const [walletError, setWalletError] = useState<string | null>(null);
  
  // Only allow Petra wallet
  const PETRA_WALLET_NAME = "Petra";
  
  // Find Petra wallet among detected wallets
  const findPetraWallet = () => {
    return wallets.find(w => 
      w.name.toLowerCase().includes('petra') || 
      (w.url && w.url.toLowerCase().includes('petra'))
    );
  };
  
  // Check wallet info on mount
  useEffect(() => {
    if (!hasLogged) {
      // Create detailed report of available wallets
      const walletDetails = wallets.map((w: any) => ({
        name: w.name,
        url: w.url,
        icon: w.icon ? 'Has icon' : 'No icon',
        isPetra: w.name.toLowerCase().includes('petra') || (w.url && w.url.toLowerCase().includes('petra'))
      }));
      
      // Check if Petra wallet is detected
      const petraWallet = findPetraWallet();
      
      if (!petraWallet) {
        // Check if Petra extension is installed
        if (typeof window !== 'undefined' && (window as any).petra) {
          // Petra extension is installed but not detected by adapter
        }
      }
      
      setHasLogged(true);
    }
  }, [wallets, wallet, connected, hasLogged]);

  const handleConnectWallet = () => {
    setWalletError(null);
    
    // Find Petra wallet
    const petraWallet = findPetraWallet();
    
    if (!petraWallet) {
      const errorMsg = "Petra wallet not found. Please install the Petra wallet extension.";
      setWalletError(errorMsg);
      message.error(errorMsg);
      return;
    }
    
    connect(petraWallet.name).catch(err => {
      setWalletError(`Failed to connect to Petra wallet: ${err.message || 'Unknown error'}`);
      message.error(`Could not connect to Petra wallet. Please make sure it's installed and unlocked.`);
    });
  };

  const handleDisconnect = () => {
    disconnect().catch(err => {
      message.error('Failed to disconnect wallet');
    });
  };

  const showWalletInfoModal = () => {
    setIsModalVisible(true);
  };

  // Check for Petra wallet specifically
  const isPetraWalletAvailable = () => {
    return !!findPetraWallet();
  };

  // Wallet information modal to help debugging
  const WalletInfoModal = () => {
    const petraWallet = findPetraWallet();
    
    return (
      <Modal
        title="Wallet Information"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={700}
      >
        <Paragraph>
          <Text strong>Petra Wallet Status</Text>
        </Paragraph>
        
        {!isPetraWalletAvailable() ? (
          <Alert
            type="warning"
            message="Petra Wallet Not Detected"
            description={
              <div>
                <p>Petra wallet is required but not detected. Please make sure:</p>
                <ul>
                  <li>Petra wallet extension is installed</li>
                  <li>The extension is enabled in your browser</li>
                  <li>You have refreshed the page after installation</li>
                </ul>
                <p>
                  <a href="https://petra.app/" target="_blank" rel="noopener noreferrer">
                    Install Petra Wallet
                  </a>
                </p>
              </div>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : (
          <List
            bordered
            dataSource={petraWallet ? [petraWallet] : []}
            renderItem={(w: any) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      {w.name}
                      <Tag color="green">Available</Tag>
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
                  onClick={handleConnectWallet}
                >
                  Connect
                </Button>
              </List.Item>
            )}
          />
        )}
        
        {walletError && (
          <Alert
            type="error"
            message="Connection Error"
            description={walletError}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    );
  };

  // If not connected, show connect button for Petra wallet
  if (!connected) {
    const petraWallet = findPetraWallet();
    
    return (
      <>
        <Space wrap>
          {connecting ? (
            <Button loading>Connecting...</Button>
          ) : !isPetraWalletAvailable() ? (
            <Button 
              type="primary" 
              danger 
              icon={<DisconnectOutlined />} 
              onClick={showWalletInfoModal}
            >
              Petra Wallet Not Found
            </Button>
          ) : (
            <Button 
              type="primary" 
              icon={<LinkOutlined />} 
              onClick={handleConnectWallet}
            >
              Connect Wallet
            </Button>
          )}
          <Button 
            type="link" 
            icon={<InfoCircleOutlined />} 
            onClick={showWalletInfoModal}
            style={{ color: 'white' }}
          />
        </Space>
        {walletError && (
          <Alert
            type="error"
            message={walletError}
            style={{ marginTop: 8 }}
            showIcon
          />
        )}
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