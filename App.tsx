import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { authService } from './services/authService';
import { Auth } from './views/Auth';
import { Onboarding } from './views/Onboarding';
import { ChatInterface } from './views/ChatInterface';
import { Spinner } from './components/UI';

// Route Wrapper component to handle logic inside AuthProvider
const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [needsLanguage, setNeedsLanguage] = useState(true);
  const [checkingLang, setCheckingLang] = useState(true);

  useEffect(() => {
    // Check if language is already set
    const lang = authService.getLanguage();
    if (lang) {
      setNeedsLanguage(false);
    }
    setCheckingLang(false);
  }, []);

  if (isLoading || checkingLang) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <Spinner />
      </div>
    );
  }

  // 1. First time user? Show Language Selection
  if (needsLanguage) {
    return <Onboarding onComplete={() => setNeedsLanguage(false)} />;
  }

  // 2. Not Authenticated? Show Login/Signup
  if (!isAuthenticated) {
    return <Auth />;
  }

  // 3. Authenticated? Show Chat
  return <ChatInterface />;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;