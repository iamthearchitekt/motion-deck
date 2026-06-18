import { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Dubstep69') {
      localStorage.setItem('motionDeckAuth', 'true');
      window.location.reload();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-10 w-auto opacity-90" />
          <h1 className="text-xl font-medium text-text-primary">Editor Login</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock size={18} className={error ? 'text-red-500' : 'text-text-muted'} />
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password..."
              autoFocus
              className={`w-full bg-surface-2 border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-border-default focus:border-accent'} rounded-xl py-3 pl-11 pr-12 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all shadow-input`}
            />
            <button
              type="submit"
              className="absolute inset-y-1.5 right-1.5 w-9 flex items-center justify-center bg-surface-3 hover:bg-accent hover:text-surface-1 rounded-lg text-text-muted transition-all"
            >
              <ArrowRight size={16} />
            </button>
          </div>
          {error && (
            <p className="absolute -bottom-6 left-0 text-xs text-red-500 font-medium animate-fade-in">
              Incorrect password.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
