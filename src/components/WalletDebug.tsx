import React from 'react';
import { Card, Typography, Descriptions, Button, Tag, Divider } from 'antd';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const { Title, Text } = Typography;

const WalletDebug: React.FC = () => {
  // Get wallet context with safer destructuring
  const walletState = useWallet();
  const { 
    account,
    connected,
    disconnect,
    wallet,
    network,
    connect
  } = walletState;
  
  // Handle potentially undefined properties
  const wallets = walletState.wallets || [];
  // TypeScript may not have these in the interface, but the latest adapter might provide them
  const connecting = (walletState as any).connecting || false;
  const disconnecting = (walletState as any).disconnecting || false;

  return (
    <Card title="Wallet Debug Information" style={{ marginTop: 24 }}>
      <Title level={4}>Connection Status</Title>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Connected">
          {connected ? (
            <Tag color="success">Connected</Tag>
          ) : (
            <Tag color="error">Not Connected</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Connecting">
          {connecting ? (
            <Tag color="processing">Connecting...</Tag>
          ) : (
            <Tag>Not Connecting</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Disconnecting">
          {disconnecting ? (
            <Tag color="processing">Disconnecting...</Tag>
          ) : (
            <Tag>Not Disconnecting</Tag>
          )}
        </Descriptions.Item>
      </Descriptions>

      <Divider />
      
      <Title level={4}>Available Wallets</Title>
      <div style={{ marginBottom: 16 }}>
        {wallets.length > 0 ? (
          wallets.map((w) => (
            <div key={w.name} style={{ marginBottom: 8 }}>
              <Button 
                type={wallet?.name === w.name ? 'primary' : 'default'}
                onClick={() => connect(w.name)}
                style={{ marginRight: 8 }}
              >
                {w.name}
              </Button>
              <Text>{w.name === wallet?.name ? "(Selected)" : ""}</Text>
            </div>
          ))
        ) : (
          <Text type="danger">No wallet adapters found!</Text>
        )}
      </div>

      <Divider />
      
      {wallet && (
        <>
          <Title level={4}>Current Wallet</Title>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">{wallet.name}</Descriptions.Item>
            <Descriptions.Item label="Wallet URL">{wallet.url}</Descriptions.Item>
            <Descriptions.Item label="Icon URL">{wallet.icon}</Descriptions.Item>
          </Descriptions>
        </>
      )}
      
      <Divider />

      {account && (
        <>
          <Title level={4}>Account</Title>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Address">{account.address}</Descriptions.Item>
            <Descriptions.Item label="Public Key">{account.publicKey?.toString() || "Unknown"}</Descriptions.Item>
          </Descriptions>
        </>
      )}
      
      <Divider />
      
      {network && (
        <>
          <Title level={4}>Network</Title>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">{network.name}</Descriptions.Item>
            <Descriptions.Item label="Chain ID">{network.chainId}</Descriptions.Item>
            <Descriptions.Item label="API URL">{network.url?.toString() || "Unknown"}</Descriptions.Item>
          </Descriptions>
        </>
      )}
      
      <Divider />
      
      <Title level={4}>Actions</Title>
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <Button
          type="primary"
          onClick={() => wallet && connect(wallet.name)}
          disabled={connected || connecting || !wallet}
        >
          Connect Wallet
        </Button>
        <Button 
          onClick={() => disconnect()}
          disabled={!connected || disconnecting || !wallet}
          danger
        >
          Disconnect Wallet
        </Button>
      </div>
    </Card>
  );
};

export default WalletDebug; 