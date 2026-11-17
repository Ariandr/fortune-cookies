import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { cloneCookiePart, COOKIE_MODEL_URL, useCookieModel } from './scene/CookieAsset';

class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="model-error" role="alert">The 3D preview could not load in this browser. You can still download the GLB below.</div> : this.props.children;
  }
}

function LoadingStatus() {
  const { active, progress } = useProgress();
  return active ? <div className="model-loading" role="status">Preparing the model <span>{Math.round(progress)}%</span></div> : null;
}

function Study({ split, onReady }: { split: number; onReady: (triangles: number) => void }) {
  const model = useCookieModel();
  const parts = useMemo(() => ({
    whole: cloneCookiePart(model.whole), left: cloneCookiePart(model.left), right: cloneCookiePart(model.right),
  }), [model]);
  const group = useRef<THREE.Group>(null!);
  const whole = useRef<THREE.Group>(null!);
  const left = useRef<THREE.Group>(null!);
  const right = useRef<THREE.Group>(null!);
  const amount = useRef(split);
  useEffect(() => onReady(model.triangles), [model, onReady]);
  useFrame((_, delta) => {
    amount.current = THREE.MathUtils.damp(amount.current, split, 6, Math.min(delta, .05));
    const t = amount.current;
    whole.current.visible = t < .001;
    left.current.visible = right.current.visible = !whole.current.visible;
    left.current.position.set(-.6 * t, -.08 * t, 0);
    right.current.position.set(.6 * t, -.08 * t, 0);
    left.current.rotation.set(0, .24*t, .13*t);
    right.current.rotation.set(0, -.24*t, -.13*t);
  });
  return <group ref={group} rotation={[.08, -.12, Math.PI/2 + .42]} dispose={null}>
    <group ref={whole}><primitive object={parts.whole}/></group>
    <group ref={left}><primitive object={parts.left}/></group>
    <group ref={right}><primitive object={parts.right}/></group>
  </group>;
}

export function ModelViewer() {
  const [split, setSplit] = useState(0);
  const [view, setView] = useState<string | null>('profile');
  const [triangles, setTriangles] = useState<number | null>(null);
  const [visible, setVisible] = useState(!document.hidden);
  const controls = useRef<OrbitControlsType>(null);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  const viewPositions: Record<string, [number, number, number]> = {
    profile: [-.2, .1, -4.8], fold: [-4, -1.9, 2.8], seam: [-2.1, 4.5, 1.5], underside: [-.1, -3.6, -2.8],
  };
  function showView(name: string) {
    const orbit = controls.current;
    if (orbit) {
      orbit.object.position.set(...viewPositions[name]);
      orbit.target.set(0, 0, 0);
      orbit.update();
    }
    setView(name);
  }
  function reset() { setSplit(0); showView('profile'); }
  return <main className="model-study">
    <header className="model-header">
      <a className="model-back" href={import.meta.env.BASE_URL}>← Fortune cookies</a>
      <span>THE COOKIE, UP CLOSE</span>
    </header>
    <div className="model-layout">
      <section className="model-viewport" aria-label="Interactive 3D fortune cookie model">
        <ModelBoundary>
          <Canvas camera={{ position: [-.2, .1, -4.8], fov: 36 }} dpr={[1, 2]} frameloop={visible ? 'always' : 'never'} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}>
            <color attach="background" args={['#ece7dc']}/>
            <ambientLight intensity={.35}/>
            <directionalLight position={[-3, 4, 5]} intensity={2.3} color="#fff3da" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-.0003} shadow-normalBias={.012}/>
            <directionalLight position={[-3, 2, -5]} intensity={1.7} color="#fff5e8"/>
            <directionalLight position={[3, 1, 3]} intensity={.6} color="#edf1ff"/>
            <Suspense fallback={null}>
              <Environment resolution={128} frames={1}>
                <Lightformer form="rect" intensity={1.6} position={[-3, 3, 4]} scale={[4, 5, 1]} target={[0, 0, 0]}/>
                <Lightformer form="rect" intensity={1.2} position={[-2, 2, -4]} scale={[4, 5, 1]} target={[0, 0, 0]}/>
                <Lightformer form="rect" intensity={.7} position={[4, 1, 3]} scale={[2, 6, 1]} target={[0, 0, 0]}/>
              </Environment>
              <Study split={split} onReady={setTriangles}/>
              <ContactShadows position={[0, -1.25, 0]} opacity={.24} scale={6} blur={2.8} far={3} resolution={256} frames={Infinity} color="#6f512a"/>
            </Suspense>
            <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={2.4} maxDistance={7} target={[0, 0, 0]} enableDamping dampingFactor={.08} onStart={() => setView(null)}/>
          </Canvas>
        </ModelBoundary>
        <LoadingStatus/>
        <div className="model-orbit-hint">DRAG TO ROTATE <span>·</span> SCROLL OR PINCH TO ZOOM</div>
      </section>
      <aside className="model-panel">
        <span className="model-kicker">REFERENCE MODEL / 01</span>
        <h1>One cookie.<br/><em>Every angle.</em></h1>
        <p className="model-description">A thin baked wafer folded into two curved wings, with a pinched center, toasted lips, and a hollow interior.</p>
        <div className="model-specs">
          <div><span>Surface</span><strong>Original 2K baked textures</strong></div>
          <div><span>Construction</span><strong>Thin shell, hollow inside</strong></div>
          <div><span>Geometry</span><strong>{triangles ? `${Math.round(triangles).toLocaleString()} triangles` : 'Loading model…'}</strong></div>
        </div>
        <div className="model-view-presets" aria-label="Views of the same cookie model">
          <span>ONE MODEL. DIFFERENT VIEWS.</span>
          <div>{[['profile', 'C profile'], ['fold', 'Center fold'], ['seam', 'Outer seam'], ['underside', 'Underside']].map(([name, label]) =>
            <button key={name} onClick={() => showView(name)} aria-pressed={view === name}>{label}</button>)}</div>
        </div>
        <div className="model-controls">
          <label htmlFor="model-split">Open the shell <span>{Math.round(split * 100)}%</span></label>
          <input id="model-split" aria-label="Separate cookie halves" type="range" min="0" max="1" step=".01" value={split} onChange={(event) => setSplit(Number(event.target.value))}/>
          <div className="model-buttons">
            <button onClick={reset}>Reset view</button>
          </div>
        </div>
        <a className="model-download" href={COOKIE_MODEL_URL} download="fortune-cookie.glb">Download the 3D model <span>GLB ↓</span></a>
        <p className="model-note">Modeled from the photo reference. The intact cookie and its breakable halves are included in the same asset.</p>
      </aside>
    </div>
    <footer className="model-footer">FORTUNE COOKIES <span>A MODEL STUDY IN CRISP EDGES & SMALL DETAILS</span></footer>
  </main>;
}
