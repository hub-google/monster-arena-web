import React, { useState } from 'react';
import { api } from '../utils/api';

/**
 * Login Page renders a premium cyberpunk-styled glassmorphism form.
 * 
 * @param {object} props
 * @param {function} props.onLoginSuccess - Callback receiving the token and user profile.
 */
export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const data = await api.register(username, email, password);
        sessionStorage.setItem('token', data.token);
        onLoginSuccess(data.user);
      } else {
        const data = await api.login(username, password);
        sessionStorage.setItem('token', data.token);
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 font-sans relative overflow-hidden">
      
      {/* Glow effects in the background */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-cyan-600 rounded-full filter blur-[100px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-600 rounded-full filter blur-[100px] opacity-10 animate-pulse"></div>

      <div className="relative w-full max-w-md glass-panel p-8 flex flex-col items-center">
        
        {/* Retro Gameboy Icon / Logo */}
        <div className="w-20 h-20 bg-slate-900/50 border border-cyan-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(8,145,178,0.3)]">
          <span className="text-4xl animate-bounce">👾</span>
        </div>

        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-wider mb-2">
          MONSTER ARENA
        </h1>
        <p className="text-sm text-cyan-200/60 mb-8 font-medium tracking-widest">
          次世代怪獸養成對戰平台
        </p>

        {/* Tab Selection */}
        <div className="w-full flex bg-slate-900/60 rounded-xl p-1.5 mb-8 border border-slate-700/50">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
              !isRegister ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            登入帳號
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
              isRegister ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            註冊新戶
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2 pl-1">
              使用者名稱 (Username)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="輸入帳號..."
              className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(8,145,178,0.2)] rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2 pl-1">
                電子信箱 (Email)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(8,145,178,0.2)] rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2 pl-1">
              密碼 (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/80 border border-slate-700 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(8,145,178,0.2)] rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-all"
            />
          </div>

          {error && (
            <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-sm text-rose-400 text-center font-bold">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full neon-button neon-button-primary py-4 mt-4 font-bold text-lg"
          >
            {loading ? '連線中...' : isRegister ? '建立帳號並登入' : '進入大廳'}
          </button>
        </form>

      </div>
    </div>
  );
}
