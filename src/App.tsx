import React, { useEffect, useState } from 'react';
import { Layout, Menu, Row, Col, Alert, message, Button, Space } from 'antd';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import '@aptos-labs/wallet-adapter-ant-design/dist/index.css';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Dashboard from './components/Dashboard';
import ConfigView from './components/ConfigView';
import NFTDetail from './components/NFTDetail';
import CustomWalletConnector from './components/CustomWalletConnector';
import Analytics from './components/Analytics';

const { Header, Content, Footer } = Layout;

// Extended interface for wallet state to include properties that might not be in type definitions
interface ExtendedWalletState {
  account: any;
  connected: boolean;
  network: any;
  wallet: any;
  wallets: any[];
  isLoading?: boolean;
  connecting?: boolean;
  disconnecting?: boolean;
}

const App: React.FC = () => {
  const location = useLocation();
  // Cast the wallet state through unknown first to avoid TypeScript errors
  const walletState = useWallet() as unknown as ExtendedWalletState;
  
  // Safely extract properties with defaults for potentially undefined ones
  const { 
    account, 
    connected, 
    network, 
    wallet,
    wallets = [],
    isLoading = false,
    connecting = false,
    disconnecting = false
  } = walletState;
  
  const [walletStatus, setWalletStatus] = useState<string>('');
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);

  // Check if wallet adapters are available
  useEffect(() => {
    // Show guide if no wallets are detected after a short delay
    const timer = setTimeout(() => {
      if (wallets.length === 0 && !isLoading) {
        setShowInstallGuide(true);
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [wallets, isLoading]);

  // Monitor and report wallet status changes
  useEffect(() => {
    if (isLoading) {
      setWalletStatus('Initializing wallet adapters...');
    } else if (connecting) {
      setWalletStatus('Connecting...');
    } else if (disconnecting) {
      setWalletStatus('Disconnecting...');
    } else if (connected && account) {
      message.success(`Connected to wallet: ${account.address.slice(0, 6)}...${account.address.slice(-4)}`);
      setWalletStatus(`Connected to ${wallet?.name || 'wallet'}`);
      setShowInstallGuide(false);
    } else if (wallets.length === 0) {
      setWalletStatus('No wallet adapters found. Please install a wallet extension.');
    } else if (!connected) {
      setWalletStatus('Wallet not connected. Please connect your wallet.');
    } else {
      setWalletStatus('');
    }
  }, [isLoading, connecting, disconnecting, connected, account, wallet, wallets]);

  const menuItems = [
    { key: '/', label: <Link to="/">Dashboard</Link> },
    { key: '/analytics', label: <Link to="/analytics">Analytics</Link> },
    { key: '/config', label: <Link to="/config">Marketplace Config</Link> },
  ];

  // Install wallet guide component
  const WalletInstallGuide = () => (
    <Row style={{ margin: '24px 0' }}>
      <Col span={24}>
        <Alert
          type="warning"
          message="No Aptos wallet detected"
          description={
            <div>
              <p>To connect to the NFT Aggregator, you need to install an Aptos wallet extension:</p>
              <Space direction="vertical">
                <Button type="primary" onClick={() => window.open('https://petra.app/', '_blank')}>
                  Install Petra Wallet
                </Button>
                <p>After installation, please refresh this page.</p>
              </Space>
            </div>
          }
          showIcon
        />
      </Col>
    </Row>
  );

  return (
    <Layout>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="logo" />
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
        <div>
          {/* Use our custom wallet connector instead of WalletSelector */}
          <CustomWalletConnector />
        </div>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        {/* Wallet status messages */}
        {walletStatus && (
          <Row style={{ margin: '16px 0' }}>
            <Col span={24}>
              <Alert 
                message={walletStatus}
                type={connected ? "success" : "info"} 
                showIcon 
              />
            </Col>
          </Row>
        )}

        {/* Wallet installation guide */}
        {showInstallGuide && <WalletInstallGuide />}

        {/* Wrong network warning */}
        {connected && network?.name?.toLowerCase() !== 'mainnet' && (
          <Row style={{ margin: '16px 0' }}>
            <Col span={24}>
              <Alert 
                message="Network mismatch" 
                description={`Your wallet is connected to ${network?.name || 'unknown'} network. Please connect to Mainnet.`}
                type="warning" 
                showIcon 
              />
            </Col>
          </Row>
        )}

        {/* Main content */}
        <div className="site-layout-content" style={{ margin: '24px 0' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/config" element={<ConfigView />} />
            <Route path="/nft/:id" element={<NFTDetail />} />
          </Routes>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        NFT Aggregator Demo ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};

export default App; 