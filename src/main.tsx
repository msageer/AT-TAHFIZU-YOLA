// Intercept non-fatal Firestore offline fallback warnings from triggering error boundaries
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const text = args
      .map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

    if (
      text.includes('Could not reach Cloud Firestore backend') ||
      text.includes("Backend didn't respond within 10 seconds") ||
      text.includes('client will operate in offline mode')
    ) {
      console.warn(...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
