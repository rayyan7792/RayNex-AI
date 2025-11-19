import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../components/UI';
import { MIN_PASSWORD_LENGTH } from '../constants';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && password.length < MIN_PASSWORD_LENGTH) {
      addToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 'error');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
        addToast('Welcome back!', 'success');
      } else {
        await signup(username, password);
        addToast('Account created successfully!', 'success');
      }
    } catch (error: any) {
      addToast(error.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black relative overflow-hidden font-sans selection:bg-white selection:text-black">
      
      {/* Ambient White Glow Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] animate-pulse-slow delay-700"></div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        
        {/* Glowing Card Container */}
        <div className="bg-black border border-white/20 rounded-2xl p-8 shadow-[0_0_40px_-10px_rgba(255,255,255,0.15)] backdrop-blur-xl relative group">
          
          {/* Animated Border Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-1000"></div>
          
          <div className="relative">
            <div className="text-center mb-10">
              <div className="w-12 h-12 bg-white rounded-lg mx-auto mb-4 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                 <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{isLogin ? 'Welcome Back' : 'Join Raynex'}</h2>
              <p className="text-slate-400 text-sm font-light tracking-wide">Enter the next dimension of AI interaction</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase tracking-wider ml-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-white focus:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all duration-300"
                  placeholder="Username"
                  required
                />
              </div>
              
              <div className="space-y-1">
                 <label className="text-xs font-bold text-white uppercase tracking-wider ml-1">Password</label>
                 <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-white focus:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all duration-300"
                  placeholder={isLogin ? "Password" : "Min 12 chars"}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-white text-black font-bold py-3.5 rounded-xl mt-4 shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-slate-400 hover:text-white transition-colors duration-300"
              >
                {isLogin ? "New to Raynex? " : "Already have an account? "}
                <span className="text-white font-bold border-b border-white/50 pb-0.5 hover:border-white">{isLogin ? 'Sign Up' : 'Log In'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};