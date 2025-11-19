import React from 'react';
import { LANGUAGES } from '../constants';
import { authService } from '../services/authService';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const handleSelectLanguage = (code: string) => {
    authService.setLanguage(code);
    onComplete();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white relative overflow-hidden font-sans">
       {/* Background Ambient Glow (Green/Fresh) */}
       <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-60"></div>
       <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-60"></div>

      <div className="relative z-10 max-w-md w-full bg-white border border-emerald-100 rounded-2xl p-8 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.15)] animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-xl mb-4 shadow-sm">
             <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
            RayNex AI
          </h1>
          <p className="text-slate-500 font-medium">
            Please select your preferred language.
            <br />
            <span className="text-sm text-emerald-600/80 italic font-normal mt-1 block">Barah-e-karam apni zaban muntakhib karein.</span>
          </p>
        </div>

        <div className="space-y-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className="w-full p-4 text-left bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all duration-200 flex items-center justify-between group shadow-sm hover:shadow-md"
            >
              <span className="font-semibold text-slate-700 group-hover:text-emerald-700">{lang.label}</span>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">Preference can be changed later in settings.</p>
        </div>
      </div>
    </div>
  );
};