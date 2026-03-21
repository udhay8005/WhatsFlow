/**
 * @file App.jsx
 * @description Root application component. Wraps the entire UI in an ErrorBoundary,
 *              the global SocketProvider (single WebSocket connection), BrowserRouter,
 *              and defines all client-side routes. Unknown routes redirect to "/".
 * @module pages/App
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import NewCampaign from './pages/NewCampaign';
import History from './pages/History';
import Blacklist from './pages/Blacklist';
import { SocketProvider } from './contexts/SocketContext';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-gray-800 border border-red-500 rounded-xl p-8 max-w-lg text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-4">The application encountered an unexpected error.</p>
            <pre className="bg-gray-900 p-4 rounded text-left text-sm text-red-300 overflow-auto max-h-48">
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="campaigns/new" element={<NewCampaign />} />
              <Route path="campaigns/:id/edit" element={<NewCampaign />} />
              <Route path="history" element={<History />} />
              <Route path="blacklist" element={<Blacklist />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </ErrorBoundary>
  );
}

export default App;
