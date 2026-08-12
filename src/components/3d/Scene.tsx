import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, PointerLockControls, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // Automatically center and scale the model so it fits reasonably in view
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());

      
      // Reset position to center
      scene.position.x = -center.x;
      scene.position.y = -box.min.y; // Align bottom to floor (y=0)
      scene.position.z = -center.z;
    }
  }, [scene]);

  return <primitive object={scene} castShadow receiveShadow />;
}

export default function Scene({ url, isNight, mode }: { url: string; isNight: boolean; mode: 'orbit' | 'walk' }) {
  return (
    <Canvas 
      shadows 
      camera={{ position: [0, 1.7, 5], fov: 60 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={[isNight ? '#0a0a0a' : '#f0f0f0']} />
      
      <Suspense fallback={null}>
        {isNight ? (
          <>
            <ambientLight intensity={0.2} />
            <directionalLight position={[5, 10, 5]} intensity={0.5} color="#4b6bfb" castShadow />
            <pointLight position={[0, 3, 0]} intensity={2} color="#ffaa00" />
            <Environment preset="night" />
          </>
        ) : (
          <>
            <ambientLight intensity={0.6} />
            <directionalLight 
              position={[10, 15, 10]} 
              intensity={1.5} 
              castShadow 
              shadow-mapSize-width={2048} 
              shadow-mapSize-height={2048} 
            />
            <Environment preset="city" />
          </>
        )}
        
        <Model url={url} />
        
        {/* Soft floor shadow */}
        <ContactShadows 
          resolution={1024} 
          scale={50} 
          blur={2} 
          opacity={isNight ? 0.8 : 0.4} 
          far={10} 
          color="#000000" 
        />
      </Suspense>
      
      {mode === 'walk' ? (
        <PointerLockControls />
      ) : (
        <OrbitControls 
          makeDefault 
          target={[0, 1, 0]}
          maxPolarAngle={Math.PI / 2 + 0.1} // Prevent going too far under ground
          minDistance={1}
          maxDistance={50}
        />
      )}
    </Canvas>
  );
}
