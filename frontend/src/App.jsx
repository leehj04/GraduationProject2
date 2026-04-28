import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminPage from './components/AdminPage';
import AuthPage from './components/AuthPage';
import MusicianSelect from './components/MusicianSelect';
import MapPage from './components/MapPage';
import SharePage from './components/SharePage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#0a0e1a]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#f5c842] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/50 font-serif">Loading...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/" element={user ? <Navigate to="/musicians" replace /> : <AuthPage />} />
      <Route path="/musicians" element={
        <ProtectedRoute><MusicianSelect /></ProtectedRoute>
      } />
      <Route path="/map/:musicianId" element={
        <ProtectedRoute><MapPage /></ProtectedRoute>
      } />
      {/* 공유 링크 — 로그인 없이 접근 가능 */}
      <Route path="/share/:token" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
