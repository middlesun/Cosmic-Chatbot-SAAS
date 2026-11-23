import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';

interface ComingSoonPageProps {
  onUnlock: () => void;
}

const ACCESS_PASSWORD = '696969';

const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === ACCESS_PASSWORD) {
      setError(null);
      onUnlock();
      return;
    }
    setError('Incorrect password. Please try again.');
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF7F2] text-[#3D3830] flex flex-col justify-between px-4 sm:px-6 py-8 font-['Plus_Jakarta_Sans',sans-serif]">
      <header className="mx-auto w-full max-w-5xl flex items-center justify-between">
        <span className="font-['Cormorant_Garamond',serif] text-2xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap">
          Cosmic Council
        </span>
      </header>

      <main className="mx-auto w-full max-w-md my-auto py-10">
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-7 sm:p-10 space-y-6">
          <div className="h-11 w-11 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/10 flex items-center justify-center text-[#8B7355]">
            <Lock className="h-5 w-5" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#8B8275]">Private Preview</p>
            <h1 className="font-['Cormorant_Garamond',serif] text-4xl sm:text-5xl font-medium text-[#3D3830] tracking-tight leading-tight">
              Coming Soon
            </h1>
            <p className="text-sm text-[#5C5449] leading-relaxed">
              We are preparing Cosmic Council for release. Enter the access password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="coming-soon-password"
                className="block text-xs font-medium text-[#5C5449]"
              >
                Access Password
              </label>
              <div className="relative">
                <input
                  id="coming-soon-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Enter password..."
                  className="w-full min-h-[46px] rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/15 pl-4 pr-11 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40 focus-visible:ring-2 focus-visible:ring-[#B8965A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl flex items-center justify-center text-[#8B8275] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Enter Site</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-xs text-[#8B8275]">
        <span>Cosmic Council</span>
      </footer>
    </div>
  );
};

export default ComingSoonPage;
