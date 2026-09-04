import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, PointerLockControls, OrbitControls, DeviceOrientationControls, ContactShadows, useProgress, Html } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false, q: false, u: false, e: false };

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

function WalkController({ active }: { active: boolean }) {
  const { camera } = useThree();
  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
  
  useFrame((_, delta) => {
    if (!active || !document.pointerLockElement) return;
    
    const speed = 15 * delta; // units per second
    
    if (keys.w) {
      camera.getWorldDirection(direction);
      direction.y = 0; // lock to horizontal plane
      direction.normalize();
      camera.position.addScaledVector(direction, speed);
    }
    if (keys.s) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      camera.position.addScaledVector(direction, -speed);
    }
    if (keys.a) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(camera.up, direction).normalize();
      camera.position.addScaledVector(right, speed);
    }
    if (keys.d) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(camera.up, direction).normalize();
      camera.position.addScaledVector(right, -speed);
    }
    // Verticality (u or e for up, q for down)
    if (keys.u || keys.e) {
      camera.position.y += speed;
    }
    if (keys.q) {
      camera.position.y -= speed;
    }
  });

  return null;
}

function TeleportController({ target, controlsRef, onArrived }: { target: THREE.Vector3 | null; controlsRef: any, onArrived: () => void }) {
  const { camera } = useThree();
  const activeTarget = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (target) activeTarget.current = target.clone();
  }, [target]);

  useFrame((_, delta) => {
    if (activeTarget.current) {
      const speed = 8 * delta; // Glide speed
      
      // We want the camera to be at eye level (1.7m) above the clicked floor point
      const eyePos = new THREE.Vector3(activeTarget.current.x, 1.7, activeTarget.current.z);
      const dist = camera.position.distanceTo(eyePos);
      
      if (dist > 0.05) {
        camera.position.lerp(eyePos, speed);
        
        // Keep orbit target just slightly in front of camera so it doesn't snap around
        if (controlsRef.current) {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          controlsRef.current.target.copy(camera.position).add(forward.multiplyScalar(0.1));
          controlsRef.current.update();
        }
      } else {
        activeTarget.current = null;
        onArrived();
      }
    }
  });
  
  return null;
}

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

function Model({ url, onTeleport }: { url: string; onTeleport: (pt: THREE.Vector3) => void }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    if (scene) {
      // Manually center the model at 0,0,0 and place it on the floor
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      
      scene.position.x = -center.x;
      scene.position.y = -box.min.y;
      scene.position.z = -center.z;

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

  return (
    <primitive 
      object={scene} 
      onPointerUp={(e: any) => {
        // Only teleport if it was a clean click/tap (not a drag to orbit)
        if (e.delta <= 2) {
          e.stopPropagation();
          onTeleport(e.point);
        }
      }}
    />
  );
}

export default function ArchitecturalViewer({ 
  url, 
  isNight, 
  mode, 
  time, 
  season,
  hdri,
  is360Mode
}: { 
  url: string; 
  isNight: boolean; 
  mode: 'walk' | 'orbit';
  time: string;
  season: string;
  hdri: string | null;
  is360Mode?: boolean;
}) {
  const orbitRef = useRef<any>(null);
  const [teleportTarget, setTeleportTarget] = useState<THREE.Vector3 | null>(null);
  
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
    <div className="relative w-full h-full">
      <Canvas 
      shadows 
      camera={{ position: [0, 1.7, 0.1], fov: 60 }}
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
        
        {hdri ? (
          <Environment files={hdri} background={true} />
        ) : (
          <Environment preset={preset} />
        )}
        
        {/* Removed Bounds to prevent camera start position overrides */}
        <Model url={url} onTeleport={setTeleportTarget} />

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
        </EffectComposer>
      </Suspense>
      
      <WalkController active={mode === 'walk' && !is360Mode} />
      <TeleportController target={teleportTarget} controlsRef={orbitRef} onArrived={() => setTeleportTarget(null)} />

      {is360Mode ? (
        <DeviceOrientationControls />
      ) : mode === 'walk' ? (
        <PointerLockControls />
      ) : (
        <OrbitControls 
          ref={orbitRef}
          makeDefault 
          autoRotate={false}
          target={[0, 1.7, 0]}
          maxPolarAngle={Math.PI / 2 + 0.05} 
          minDistance={0.1}
          maxDistance={100}
        />
      )}
    </Canvas>
    </div>
  );
}
