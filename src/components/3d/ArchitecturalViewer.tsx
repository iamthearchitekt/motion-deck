import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, PointerLockControls, OrbitControls, ContactShadows, Bounds, useProgress, Html } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center text-white bg-black/80 px-8 py-6 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="w-10 h-10 border-4 border-transparent border-t-accent rounded-full animate-spin mb-4"></div>
        <div className="font-bold text-lg mb-1">Loading 3D Space</div>
        <div className="text-sm text-white/60 font-mono">{progress.toFixed(0)}%</div>
      </div>
    </Html>
  );
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Boost reflections slightly for architectural materials
          if (child.material) {
            child.material.envMapIntensity = 1.2;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [scene]);

  return <primitive object={scene} />;
}

export default function ArchitecturalViewer({ 
  url, 
  isNight, 
  mode, 
  time, 
  season 
}: { 
  url: string; 
  isNight: boolean; 
  mode: 'walk' | 'orbit';
  time: string;
  season: string;
}) {
  
  // Determine lighting and HDRI preset based on season and time
  let preset: any = 'city';
  let ambientIntensity = 0.5;
  let sunColor = '#ffffff';
  let sunIntensity = 1;
  let bg = '#f0f0f0';
  let sunPosition: [number, number, number] = [10, 20, 10];

  if (isNight || time === 'night') {
    preset = 'night';
    ambientIntensity = 0.1;
    sunColor = '#4b6bfb';
    sunIntensity = 0.3;
    bg = '#0a0a0c';
  } else if (time === 'sunset') {
    preset = 'sunset';
    ambientIntensity = 0.3;
    sunColor = '#ffaa55';
    sunIntensity = 1.5;
    bg = '#1a1005';
    sunPosition = [30, 5, -20]; // Low sun
  } else if (time === 'morning') {
    preset = 'dawn';
    ambientIntensity = 0.4;
    sunColor = '#ffeedd';
    sunIntensity = 1.2;
    bg = '#2a3040';
    sunPosition = [-30, 10, 20];
  } else {
    // noon
    preset = season === 'winter' ? 'snow' : 'city';
    ambientIntensity = season === 'winter' ? 0.7 : 0.5;
    sunColor = season === 'autumn' ? '#ffe0b2' : '#ffffff';
    sunIntensity = season === 'summer' ? 1.5 : 1.2;
    bg = season === 'winter' ? '#e0e5eb' : '#d0d8e0';
  }

  // Adjust for season
  if (season === 'autumn' && !isNight && time !== 'sunset') {
    sunColor = '#ffcc88';
    sunPosition = [20, 15, 10]; // Lower sun in autumn
  }
  if (season === 'winter' && !isNight) {
    sunColor = '#e0f0ff';
    sunPosition = [20, 10, 10]; // Even lower sun in winter
  }

  return (
    <Canvas 
      shadows 
      camera={{ position: [0, 1.7, 8], fov: 60 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, stencil: false }}
    >
      <color attach="background" args={[bg]} />
      
      <Suspense fallback={<Loader />}>
        <ambientLight intensity={ambientIntensity} />
        
        {/* Main Sun */}
        <directionalLight 
          position={sunPosition} 
          intensity={sunIntensity} 
          color={sunColor} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
        
        {/* Gentle fill light opposite the sun */}
        <directionalLight 
          position={[-sunPosition[0], sunPosition[1] * 0.5, -sunPosition[2]]} 
          intensity={ambientIntensity * 0.5} 
          color="#aaccff" 
        />
        
        <Environment preset={preset} />
        
        <Bounds fit clip observe margin={1.2}>
          <Model url={url} />
        </Bounds>

        {/* Soft floor shadow */}
        <ContactShadows 
          resolution={1024} 
          scale={100} 
          blur={2.5} 
          opacity={isNight || time === 'night' ? 0.8 : 0.4} 
          far={20} 
          color="#000000" 
        />

        <EffectComposer multisampling={4}>
          <SSAO 
            radius={0.05} 
            intensity={10} 
            luminanceInfluence={0.5} 
          />
          <Bloom 
            luminanceThreshold={1.5} 
            mipmapBlur 
            intensity={isNight || time === 'sunset' || time === 'night' ? 0.8 : 0.15} 
          />
          {/* Note: Postprocessing automatically uses ACESFilmic ToneMapping by default in newer versions, but we can enforce exposure via gl prop if needed, or stick to default Postprocessing tone mapping. */}
        </EffectComposer>
      </Suspense>
      
      {mode === 'walk' ? (
        <PointerLockControls />
      ) : (
        <OrbitControls 
          makeDefault 
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2 + 0.05} 
          minDistance={1}
          maxDistance={100}
        />
      )}
    </Canvas>
  );
}
