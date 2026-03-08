import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import HomePage from './pages/HomePage';
import ComponentsPage from './pages/ComponentsPage';
import PlaygroundPage from './pages/PlaygroundPage';

export default function App() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <Navbar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Routes>
          <Route path="/"           element={<HomePage />} />
          <Route path="/components" element={<ComponentsPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
