// This file contains module declarations for imports

declare module '*.css';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.json';

// Component modules
declare module './components/Dashboard' {
  const Dashboard: React.FC;
  export default Dashboard;
}

declare module './components/ConfigView' {
  const ConfigView: React.FC;
  export default ConfigView;
}

declare module './components/NFTDetail' {
  const NFTDetail: React.FC;
  export default NFTDetail;
}

declare module './components/NFTCard' {
  const NFTCard: React.FC<{nft: any}>;
  export default NFTCard;
}

declare module './App' {
  const App: React.FC;
  export default App;
} 