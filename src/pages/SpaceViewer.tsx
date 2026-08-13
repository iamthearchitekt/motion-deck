import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ArchitecturalViewer from '../components/3d/ArchitecturalViewer';
import { Sun, Moon, Maximize, Orbit, Footprints, AlertCircle, Smartphone } from 'lucide-react';

export default function SpaceViewer() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url');
  const time = searchParams.get('time') || 'noon';
  const season = searchParams.get('season') || 'summer';
  const hdri = searchParams.get('hdri');
  
  const [isNight, setIsNight] = useState(time === 'night');
  const [mode, setMode] = useState<'walk' | 'orbit'>('walk');
  const [is360Mode, setIs360Mode] = useState(false);

  const requestGyroPermission = () => {
    if (is360Mode) {
      setIs360Mode(false);
      return;
    }
    
    if (typeof (window as any).DeviceOrientationEvent !== 'undefined' && typeof (window as any).DeviceOrientationEvent.requestPermission === 'function') {
      (window as any).DeviceOrientationEvent.requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            setIs360Mode(true);
          } else {
            alert('Permission to access device orientation was denied.');
          }
        })
        .catch(console.error);
    } else {
      setIs360Mode(true);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!url) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold">No 3D Model Provided</h1>
        <p className="text-gray-400 mt-2">Please launch this viewer from a Motiondeck presentation.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden font-sans">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 pointer-events-auto">
          {/* Mock Client Logo / Text */}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
             <span className="text-white font-bold text-xs">MD</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Client Showcase</h1>
            <p className="text-white/60 text-xs">Interactive 3D Space</p>
          </div>
        </div>
      </div>

      {/* Floating Controls Container */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 w-max max-w-[98vw]">
        <div className="flex items-center gap-1 sm:gap-2 bg-black/60 backdrop-blur-xl p-1 sm:p-2 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto no-scrollbar w-full justify-center">
          
          <button 
            onClick={() => setMode('walk')}
            className={`px-3 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${mode === 'walk' ? 'bg-accent text-black' : 'text-white hover:bg-white/10'}`}
          >
            <Footprints size={16} /> Walk
          </button>
          
          <button 
            onClick={() => setMode('orbit')}
            className={`px-3 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${mode === 'orbit' && !is360Mode ? 'bg-accent text-black' : 'text-white hover:bg-white/10'}`}
          >
            <Orbit size={16} /> Orbit
          </button>

          {/* 360 AR Button */}
          <button 
            onClick={requestGyroPermission}
            className={`px-3 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${is360Mode ? 'bg-accent text-black' : 'text-white hover:bg-white/10'}`}
          >
            <Smartphone size={16} /> 360 AR
          </button>

          <div className="w-px h-6 sm:h-8 bg-white/20 mx-1 sm:mx-2 flex-shrink-0" />

          <button 
            onClick={() => setIsNight(!isNight)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors"
            title="Toggle Day/Night"
          >
            {isNight ? <Moon size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Sun size={16} className="sm:w-[18px] sm:h-[18px]" />}
          </button>

          <button 
            onClick={toggleFullscreen}
            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors"
            title="Fullscreen"
          >
            <Maximize size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>

        </div>
        <div className="hidden sm:block text-white/30 text-[10px] font-medium tracking-widest uppercase pointer-events-none select-none">
          Press ESC to Exit
        </div>
      </div>

      {/* 360 AR Instructions */}
      {is360Mode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-40">
          <p className="text-white text-sm bg-black/50 px-4 py-2 rounded-lg text-center">Look around using your device.</p>
        </div>
      )}

      {/* Instructions for Walk mode */}
      {mode === 'walk' && !is360Mode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-40">
          <p className="text-white text-sm bg-black/50 px-4 py-2 rounded-lg text-center">Click anywhere to look around.<br/>Press ESC to unlock.</p>
        </div>
      )}

      {/* 3D Canvas */}
      <div className="w-full h-full absolute inset-0 z-0">
        <ArchitecturalViewer url={url} isNight={isNight} mode={mode} time={time} season={season} hdri={hdri} is360Mode={is360Mode} />
      </div>

    </div>
  );
}
