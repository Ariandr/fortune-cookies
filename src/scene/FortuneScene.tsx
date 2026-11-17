import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { makeCookieHalf, makeWaferTexture } from './cookieGeometry';
import { cookieLayout, type CookiePosition } from './layout';

export interface SceneProps {
  phase: 'idle' | 'opening' | 'revealed';
  selected: number;
  reducedMotion: boolean;
  visible: boolean;
  onChoose: (index: number) => void;
  onReveal: () => void;
  onFailure: () => void;
  hovered: number | null;
  onCookieLayout: (index: number, x: number, y: number, width: number) => void;
  onPaperLayout: (x: number, y: number, width: number, height: number) => void;
}
const smooth = (a: number, b: number, t: number) => {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const lerp = THREE.MathUtils.lerp;

function Cookie({ index, position, geometry, material, props, progress }: {
  index: number; position: CookiePosition; geometry: [THREE.BufferGeometry, THREE.BufferGeometry]; material: THREE.Material[];
  props: SceneProps; progress: React.RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null!);
  const left = useRef<THREE.Mesh>(null!);
  const right = useRef<THREE.Mesh>(null!);
  const hovered = props.hovered === index;
  const { camera, viewport, size } = useThree();
  const projected = useMemo(() => new THREE.Vector3(), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const worldScale = useMemo(() => new THREE.Vector3(), []);
  const isChosen = props.phase !== 'idle' && props.selected === index;
  useFrame(({ clock }) => {
    const time = props.reducedMotion ? 0 : clock.elapsedTime;
    const opening = progress.current;
    const focus = props.phase === 'idle' ? 0 : smooth(0, 0.85, opening);
    const split = isChosen ? smooth(0.85, 1.58, opening) : 0;
    const settle = isChosen ? smooth(1.45, 2.95, opening) : 0;
    const float = Math.sin(time * 0.52 + index * 2.1) * 0.11;
    const hover = hovered && props.phase === 'idle' ? 1.045 : 1;
    const s = isChosen ? lerp(position.scale, 1.32, focus) : position.scale * lerp(1, 0.7, focus);
    group.current.scale.setScalar(s * hover * (1 - Math.sin(split * Math.PI) * 0.025));
    group.current.position.set(
      isChosen ? lerp(position.x, 0, focus) : position.x * (1 + focus * 0.12),
      isChosen ? lerp(position.y + float, 0.08, focus) : position.y + float,
      isChosen ? lerp(0, 2, focus) : -focus * 3.8,
    );
    group.current.rotation.set(
      lerp(position.rotation[0] + Math.sin(time * 0.3 + index) * 0.045, 0.12, isChosen ? focus : 0),
      lerp(position.rotation[1] + Math.sin(time * 0.27 + index * 1.7) * 0.08, 0, isChosen ? focus : 0),
      lerp(position.rotation[2] + Math.sin(time * 0.36 + index) * 0.055, 0, isChosen ? focus : 0),
    );
    left.current.position.set(-split * 0.6 - settle * 0.65, -settle * 0.52, -settle * 0.2);
    right.current.position.set(split * 0.6 + settle * 0.65, -settle * 0.52, -settle * 0.2);
    left.current.rotation.set(settle * 0.18, split * 0.42, split * 0.28);
    right.current.rotation.set(settle * -0.18, -split * 0.42, -split * 0.28);
    group.current.updateWorldMatrix(true, false);
    projected.set(0, 0.1, 0.35).applyMatrix4(group.current.matrixWorld).project(camera);
    group.current.getWorldPosition(worldPosition);
    group.current.getWorldScale(worldScale);
    const targetWidth = 2.3 * worldScale.x * size.height / viewport.height * 16 / (16 - worldPosition.z);
    props.onCookieLayout(index, (projected.x + 1) * size.width / 2, (1 - projected.y) * size.height / 2, targetWidth);
  });
  return <group ref={group}>
    <mesh ref={left} geometry={geometry[0]} material={material} />
    <mesh ref={right} geometry={geometry[1]} material={material} />

  </group>;
}

function Paper({ progress, active, onLayout }: { progress: React.RefObject<number>; active: boolean; onLayout: SceneProps['onPaperLayout'] }) {
  const { camera, size } = useThree();
  const topLeft = useMemo(() => new THREE.Vector3(), []);
  const bottomRight = useMemo(() => new THREE.Vector3(), []);
  const parentScale = useMemo(() => new THREE.Vector3(), []);
  const paperOrigin = useMemo(() => new THREE.Vector3(), []);
  const previousCurl = useRef(-1);
  const mesh = useRef<THREE.Mesh>(null!);
  const geometry = useMemo(() => new THREE.PlaneGeometry(4.8, 2.35, 52, 10), []);
  const original = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const t = progress.current;
    const emerge = smooth(1.35, 2.35, t);
    const unfold = smooth(1.7, 2.95, t);
    mesh.current.visible = active && t > 1.35;
    mesh.current.position.set(0, lerp(-0.18, 0.28, emerge), 2.7);
    mesh.current.rotation.set(lerp(-0.7, 0, emerge), lerp(0.35, 0, unfold), lerp(-0.12, 0, unfold));
    if (!active) return;
    mesh.current.parent!.updateWorldMatrix(true, false);
    mesh.current.parent!.getWorldScale(parentScale);
    paperOrigin.set(0, 0.28, 2.7).applyMatrix4(mesh.current.parent!.matrixWorld);
    const pixelsPerUnit = size.height * camera.projectionMatrix.elements[5] / (2 * (camera.position.z - paperOrigin.z));
    const fit = Math.min(size.width * 0.86, 440) / (4.8 * parentScale.x * pixelsPerUnit);
    mesh.current.scale.set(lerp(0.06, 1, emerge) * fit, lerp(0.2, 1, emerge) * fit, 1);
    const attr = geometry.attributes.position;
    if (previousCurl.current !== unfold) {
    for (let i = 0; i < attr.count; i++) {
      const x = original[i * 3], y = original[i * 3 + 1];
      const curl = (1 - unfold) * 2.4;
      const edge = Math.max(0, (Math.abs(x) - 1.8) / 0.6);
      attr.setXYZ(i, x * (1 - (1 - unfold) * 0.12), y, Math.sin(x * 1.5) * curl * 0.25 + edge ** 2 * 0.035);
    }
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
    previousCurl.current = unfold;
    }
    if (active) {
      mesh.current.updateWorldMatrix(true, false);
      topLeft.set(-2.4, 1.175, 0).applyMatrix4(mesh.current.matrixWorld).project(camera);
      bottomRight.set(2.4, -1.175, 0).applyMatrix4(mesh.current.matrixWorld).project(camera);
      const width = Math.abs(bottomRight.x - topLeft.x) * size.width / 2;
      const height = Math.abs(bottomRight.y - topLeft.y) * size.height / 2;
      onLayout((topLeft.x + bottomRight.x + 2) * size.width / 4, (2 - topLeft.y - bottomRight.y) * size.height / 4, width, height);
    }
  });
  return <mesh ref={mesh} geometry={geometry}>
    <meshStandardMaterial color="#fff9ea" side={THREE.DoubleSide} roughness={0.96} />
  </mesh>;
}

function Crumbs({ progress, reducedMotion }: { progress: React.RefObject<number>; reducedMotion: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c98c3f', roughness: 0.95 }), []);
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(0.035, 0), []);
  useEffect(() => () => { material.dispose(); geometry.dispose(); }, [material, geometry]);
  useFrame(() => {
    const t = Math.max(0, progress.current - 1.08);
    meshes.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.visible = !reducedMotion && t > 0 && t < 1.25;
      const angle = i * 2.399;
      mesh.position.set(Math.cos(angle) * t * (0.65 + i * 0.04), 0.2 + Math.sin(angle) * t * 0.7 - t * t * 1.4, 2.2 + Math.sin(i * 3) * t * 0.35);
      mesh.rotation.set(t * (i + 1), t * 2, t * i);
      mesh.scale.setScalar(1 - smooth(0.5, 1.25, t));
    });
  });
  return <>{Array.from({ length: 13 }, (_, i) => <mesh key={i} ref={(el) => { meshes.current[i] = el; }} geometry={geometry} material={material} />)}</>;
}

function World(props: SceneProps) {
  const { viewport, gl, size } = useThree();
  const portrait = size.width < 700;
  const layout = useMemo(() => cookieLayout(portrait), [portrait]);
  const progress = useRef(props.phase === 'revealed' ? 3.2 : 0);
  const elapsed = useRef(0);
  const hasRevealed = useRef(false);
  const geometry = useMemo(() => [makeCookieHalf(-1), makeCookieHalf(1)] as [THREE.BufferGeometry, THREE.BufferGeometry], []);
  const texture = useMemo(makeWaferTexture, []);
  const material = useMemo(() => [new THREE.MeshStandardMaterial({
    color: '#dba65a', vertexColors: true, roughness: 0.72, metalness: 0,
    side: THREE.DoubleSide, bumpMap: texture, bumpScale: 0.035,
  }), new THREE.MeshStandardMaterial({ color: '#965b28', roughness: 0.94, side: THREE.DoubleSide })], [texture]);
  // WebGL texture coordinates follow the folded wafer surface.
  useMemo(() => geometry.forEach((g) => {
    const p = g.attributes.position;
    const uv: number[] = [];
    for (let i = 0; i < p.count; i++) uv.push(p.getX(i) * 0.85 + 0.5, p.getY(i) * 1.2 + p.getZ(i) * 0.35);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }), [geometry]);
  useEffect(() => {
    const fail = (event: Event) => { event.preventDefault(); props.onFailure(); };
    gl.domElement.addEventListener('webglcontextlost', fail);
    return () => gl.domElement.removeEventListener('webglcontextlost', fail);
  }, [gl, props.onFailure]);
  useEffect(() => {
    elapsed.current = 0;
    hasRevealed.current = false;
    progress.current = props.phase === 'revealed' ? 3.2 : 0;
  }, [props.phase]);
  useEffect(() => () => { geometry.forEach((g) => g.dispose()); material.forEach((m) => m.dispose()); texture.dispose(); }, [geometry, material, texture]);
  useFrame((_, delta) => {
    if (props.phase === 'opening') {
      elapsed.current += Math.min(delta, 0.05);
      progress.current = props.reducedMotion ? 3.2 : elapsed.current;
      if (progress.current >= 3.05 && !hasRevealed.current) {
        hasRevealed.current = true;
        props.onReveal();
      }
    }
  }, -1);
  const scale = portrait ? Math.min(viewport.width / 7.5, viewport.height / 8.4) : Math.min(viewport.width / 13.3, viewport.height / 7.4);
  return <>
    <ambientLight intensity={0.75} />
    <directionalLight position={[-4, 6, 8]} intensity={2.8} color="#fff0d8" />
    <directionalLight position={[5, 1, 4]} intensity={0.6} color="#eedac4" />
    <directionalLight position={[1, -4, -2]} intensity={1.1} color="#d7b892" />
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={1.5} position={[-4, 4, 4]} scale={[6, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.8} position={[4, 2, 2]} scale={[4, 8, 1]} target={[0, 0, 0]} />
    </Environment>
    <group scale={scale} position={[0, portrait ? 0.3 * scale : 0, 0]}>
      {layout.map((position, index) => <Cookie key={index} index={index} position={position} geometry={geometry} material={material} props={props} progress={progress} />)}
      <Paper progress={progress} active={props.phase !== 'idle'} onLayout={props.onPaperLayout} />
      <Crumbs progress={progress} reducedMotion={props.reducedMotion} />
    </group>
  </>;
}

export default function FortuneScene(props: SceneProps) {
  return <Canvas
    camera={{ position: [0, 0, 16], fov: 34, near: 0.1, far: 50 }}
    dpr={[1, 1.65]}
    frameloop={props.visible ? 'always' : 'never'}
    gl={{ antialias: true, alpha: true, powerPreference: 'low-power', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
    fallback={<span />}
    onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
  >
    <Suspense fallback={null}><World {...props} /></Suspense>
  </Canvas>;
}
