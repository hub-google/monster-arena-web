import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { firebaseConfigured } from './utils/firebaseClient';

function FirebaseConfigurationNotice() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <section className="max-w-md w-full rounded-2xl border border-amber-600/40 bg-slate-900 p-7 text-center">
        <h1 className="text-xl font-bold text-amber-400 mb-3">遊戲登入服務尚未設定完成</h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          網站缺少有效的 Firebase 網頁應用程式設定。這是伺服器部署設定問題，
          並不是您的帳號或密碼錯誤。請聯絡網站管理員處理。
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {firebaseConfigured ? <App /> : <FirebaseConfigurationNotice />}
  </StrictMode>
);
