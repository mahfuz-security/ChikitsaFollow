import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

function roundedSquare(size: number, radius: number) {
  const shape = new THREE.Shape();
  const half = size / 2;
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  return shape;
}

export default function LoginScene({ paused, icon = false }: { paused: boolean; icon?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pauseRef = useRef(paused);
  pauseRef.current = paused;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      // Sign-in remains fully usable on devices without WebGL.
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute("aria-hidden", "true");
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 100);
    camera.position.set(0, 0, 14);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();

    const sculpture = new THREE.Group();
    scene.add(sculpture);
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    function extrude(shape: THREE.Shape, depth: number, material: THREE.Material) {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 4, steps: 1, curveSegments: 24 });
      geometries.push(geometry);
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      sculpture.add(mesh);
      return mesh;
    }

    const teal = new THREE.MeshPhysicalMaterial({ color: 0x1e7f79, metalness: 0.3, roughness: 0.22, clearcoat: 1 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xd5eeeb, metalness: 0.05, roughness: 0.12, transmission: 0.5, thickness: 0.7, transparent: true, opacity: 0.9 });
    const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf4fbfa, metalness: 0.15, roughness: 0.2, clearcoat: 1 });
    const back = extrude(roundedSquare(3.4, 0.65), 0.16, teal);
    back.position.z = -0.6;
    back.rotation.z = -0.17;
    const front = extrude(roundedSquare(3.05, 0.56), 0.12, glass);
    front.position.z = -0.15;
    front.rotation.z = 0.07;

    const cross = new THREE.Shape();
    const points = [[-0.34, 1], [0.34, 1], [0.34, 0.34], [1, 0.34], [1, -0.34], [0.34, -0.34], [0.34, -1], [-0.34, -1], [-0.34, -0.34], [-1, -0.34], [-1, 0.34], [-0.34, 0.34]];
    points.forEach(([x = 0, y = 0], index) => index ? cross.lineTo(x, y) : cross.moveTo(x, y));
    cross.closePath();
    const emblem = extrude(cross, 0.35, porcelain);
    emblem.position.z = 0.18;
    const outlinePath = new THREE.CurvePath<THREE.Vector3>();
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]!;
      outlinePath.add(new THREE.LineCurve3(new THREE.Vector3(point[0], point[1], 0), new THREE.Vector3(next[0], next[1], 0)));
    });
    const outlineGeometry = new THREE.TubeGeometry(outlinePath, 120, .03, 8, true);
    const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xc92d40 });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.z = .61;
    sculpture.add(outline); geometries.push(outlineGeometry); materials.push(outlineMaterial);

    const frameShape = roundedSquare(3.9, 0.8);
    frameShape.holes.push(new THREE.Path(roundedSquare(3.78, 0.74).getPoints(24)));
    const frame = extrude(frameShape, 0.04, new THREE.MeshPhysicalMaterial({ color: 0x8fbab7, metalness: 0.7, roughness: 0.25 }));
    frame.position.z = -0.95;
    frame.rotation.z = 0.12;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x326e73, 2));
    const light = new THREE.DirectionalLight(0xffffff, 4);
    light.position.set(-3, 6, 8);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xe8735c, 1.5);
    rim.position.set(5, -2, 3);
    scene.add(rim);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = new THREE.Vector2();
    let baseY = 0;
    let phase = 0;
    let previous = 0;
    let animationFrame = 0;
    function render() { renderer.render(scene, camera); }
    function resize() {
      const width = element!.clientWidth;
      const height = element!.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      camera.left = -4 * aspect;
      camera.right = 4 * aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      const mobile = width <= 760;
      sculpture.position.x = mobile ? 0 : aspect * 1.95;
      baseY = mobile ? 4 - 205 / height * 8 : 0.1;
      sculpture.position.y = baseY;
      sculpture.scale.setScalar(mobile ? 440 / height : Math.min(1.15, 680 / height));
      sculpture.rotation.set(0.12, -0.36, -0.12);
      if (icon) {
        sculpture.position.set(0, 0, 0);
        sculpture.scale.setScalar(1.65);
      }
      render();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    function move(event: PointerEvent) {
      pointer.set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
    }
    function resetPointer() { pointer.set(0, 0); }
    function animate(now: number) {
      animationFrame = requestAnimationFrame(animate);
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (pauseRef.current || media.matches || document.hidden) return;
      phase += delta;
      sculpture.rotation.y += (-0.36 + pointer.x * 0.3 + Math.sin(phase * 0.35) * 0.08 - sculpture.rotation.y) * 0.05;
      sculpture.rotation.x += (0.12 + pointer.y * 0.16 - sculpture.rotation.x) * 0.05;
      sculpture.position.y = baseY + Math.sin(phase * 0.65) * 0.07;
      render();
    }
    function updateTheme() {
      const dark = document.documentElement.dataset.theme === "dark";
      teal.color.set(dark ? 0x247d79 : 0x1e7f79);
      renderer.toneMappingExposure = dark ? 1.1 : 1.35;
      render();
    }
    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", resetPointer);
    resize();
    updateTheme();
    if (!icon) animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", resetPointer);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [icon]);

  return <div className="login-scene" ref={host} aria-hidden="true" />;
}
