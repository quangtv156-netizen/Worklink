import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppProvider, useAuth, useChat, useJob } from './context/AppContext';
import JobSeekerLayout from './layouts/JobSeekerLayout';
import EmployerLayout from './layouts/EmployerLayout';
import AdminLayout from './layouts/AdminLayout';
import JobDetailModal from './components/JobDetailModal';
import QuickApplyModal from './components/QuickApplyModal';
import JobEditModal from './components/JobEditModal';
import GigEditModal from './components/GigEditModal';
import AuthModal from './components/AuthModal';
import AICopilotDrawer from './components/AICopilotDrawer';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

// Code-split heavy modals
const AICVAnalyzerModal = lazy(() => import('./components/AICVAnalyzerModal'));
const DirectMessengerModal = lazy(() => import('./components/DirectMessengerModal'));

function MainContent() {
  const { currentUser, isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const { activeChatRecipient } = useChat();
  const { jobs, setSelectedJobForDetail } = useJob();
  const [activePortal, setActivePortal] = useState('seeker'); // 'seeker' | 'employer' | 'admin'

  // Hỗ trợ deep-link chia sẻ liên kết việc làm qua URL (?job=job-1)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const targetJobId = params.get('job');
      if (targetJobId && jobs && jobs.length > 0) {
        const found = jobs.find(j => j.id === targetJobId);
        if (found) {
          setSelectedJobForDetail(found);
        }
      }
    } catch {}
  }, [jobs, setSelectedJobForDetail]);

  // Automatically synchronize portal based on logged-in user role
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setActivePortal('admin');
    } else if (currentUser?.role === 'employer') {
      setActivePortal('employer');
    } else {
      setActivePortal('seeker');
    }
  }, [currentUser?.role, currentUser?.id]);

  // Security guard: Non-admins cannot stay in admin portal; non-employers/non-admins cannot stay in employer portal
  const effectivePortal = (() => {
    if (activePortal === 'admin' && currentUser?.role !== 'admin') {
      return 'seeker';
    }
    if (activePortal === 'employer' && currentUser?.role !== 'employer' && currentUser?.role !== 'admin') {
      return 'seeker';
    }
    return activePortal;
  })();

  return (
    <>
      <OfflineBanner />
      {/* Dedicated Portal Rendering */}
      {effectivePortal === 'admin' && (
        <AdminLayout onSwitchPortal={setActivePortal} />
      )}

      {effectivePortal === 'employer' && (
        <EmployerLayout onSwitchPortal={setActivePortal} />
      )}

      {effectivePortal === 'seeker' && (
        <JobSeekerLayout onSwitchPortal={setActivePortal} />
      )}

      {/* Global Modals & Notifications */}
      <Suspense fallback={null}>
        <AICVAnalyzerModal />
      </Suspense>

      <JobDetailModal />
      <JobEditModal />
      <GigEditModal />
      <QuickApplyModal />

      <Suspense fallback={null}>
        {activeChatRecipient && <DirectMessengerModal />}
      </Suspense>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <AICopilotDrawer />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
