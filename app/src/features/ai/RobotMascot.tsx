import { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";
import * as THREE from "three";

export type RobotMood = "idle" | "wave" | "thinking" | "happy";

export default function RobotMascot({ mood = "idle" }: { mood?: RobotMood }) {
  const host = useRef<HTMLSpanElement>(null);
  const current = useRef({ mood, changed: performance.now() });
  const [ready, setReady] = useState(false);
  useEffect(() => { current.current = { mood, changed: performance.now() }; }, [mood]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.25, 2.25, 2.45, -2.05, .1, 30);
    camera.position.set(0, .1, 12);
    const robot = new THREE.Group();
    scene.add(robot);
    robot.rotation.set(.04, -.16, 0);
    const ivory = new THREE.MeshPhysicalMaterial({ color: 0xeaf7f5, roughness: .24, metalness: .12, clearcoat: 1 });
    const teal = new THREE.MeshPhysicalMaterial({ color: 0x218d83, roughness: .25, metalness: .2, clearcoat: 1 });
    const face = new THREE.MeshStandardMaterial({ color: 0x183637, roughness: .3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x72ecf4, emissive: 0x1bafb9, emissiveIntensity: .6 });
    const coral = new THREE.MeshStandardMaterial({ color: 0xffb19f, roughness: .3 });
    const geometries: THREE.BufferGeometry[] = [];
    function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
      geometries.push(geometry);
      const item = new THREE.Mesh(geometry, material);
      item.position.set(x, y, z); parent.add(item); return item;
    }
    function rounded(w: number, h: number, depth: number, r: number) {
      const s = new THREE.Shape();
      s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2);
      s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r);
      s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
      s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r);
      s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: .065, bevelThickness: .065, bevelSegments: 3, steps: 1, curveSegments: 12 });
    }
    const head = new THREE.Group(); head.position.y = .65; robot.add(head);
    mesh(rounded(2.2, 1.48, .5, .4), ivory, head, 0, 0, -.28);
    mesh(rounded(1.82, 1.02, .07, .3), face, head, 0, -.015, .3);
    mesh(new THREE.SphereGeometry(.23, 16, 12), teal, head, -1.2);
    mesh(new THREE.SphereGeometry(.23, 16, 12), teal, head, 1.2);
    const eyes = [-.43, .43].map(x => {
      const eye = mesh(new THREE.SphereGeometry(.16, 20, 12), blue, head, x, .08, .46);
      eye.scale.set(.85, 1.1, .4); return eye;
    });
    const smile = mesh(new THREE.TorusGeometry(.24, .038, 8, 24, Math.PI), blue, head, 0, -.12, .46);
    smile.rotation.z = Math.PI;
    mesh(new THREE.CylinderGeometry(.045, .045, .36, 12), teal, head, 0, .93);
    const antenna = mesh(new THREE.SphereGeometry(.13, 16, 12), coral, head, 0, 1.16);
    mesh(rounded(1.25, .92, .5, .3), ivory, robot, 0, -.68, -.2);
    mesh(new THREE.SphereGeometry(.22, 20, 12), teal, robot, 0, -.65, .4);
    mesh(new THREE.BoxGeometry(.24, .065, .06), ivory, robot, 0, -.65, .6);
    mesh(new THREE.BoxGeometry(.065, .24, .06), ivory, robot, 0, -.65, .6);
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group(); arm.position.set(side * .83, -.35, 0); robot.add(arm);
      mesh(new THREE.CapsuleGeometry(.14, .43, 4, 12), teal, arm, 0, -.28);
      mesh(new THREE.SphereGeometry(.2, 16, 12), ivory, arm, 0, -.58, .05);
      return arm;
    });
    for (const x of [-.35, .35]) {
      const foot = mesh(new THREE.SphereGeometry(.25, 16, 12), teal, robot, x, -1.32, .13);
      foot.scale.set(1, .55, 1.3);
    }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x668b88, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 4); key.position.set(-3, 5, 8); scene.add(key);
    const fill = new THREE.DirectionalLight(0xb3f1e8, 2); fill.position.set(4, 1, 5); scene.add(fill);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastPose = "";
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const { mood: state, changed } = current.current;
      const elapsed = (now - changed) / 1000;
      // Idle greetings finish; only an active request keeps the robot moving.
      const active = !reduced.matches && (elapsed < 4 || state === "thinking");
      const pose = active ? String(now) : `${state}-rest-${reduced.matches}`;
      if (pose === lastPose) return;
      lastPose = pose;
      const t = active ? elapsed : 0;
      robot.position.y = active ? Math.sin(t * 3) * .05 : 0;
      head.rotation.z = state === "thinking" ? -.13 + Math.sin(t * 3) * .08 : state === "happy" && active ? Math.sin(t * 7) * .1 : 0;
      head.rotation.y = state === "wave" && active ? Math.sin(t * 3) * .12 : 0;
      arms[0]!.rotation.z = -.12;
      arms[1]!.rotation.z = (state === "wave" || state === "idle") && active ? 2.35 + Math.sin(t * 9) * .25 : state === "thinking" ? 1.5 : .12;
      const blink = active && (t % 2.8 > 2.55) ? .12 : 1.1;
      eyes.forEach(eye => { eye.scale.y = state === "happy" ? blink * .65 : blink; });
      antenna.scale.setScalar(state === "thinking" && active ? 1 + Math.sin(t * 5) * .15 : 1);
      renderer.render(scene, camera);
    }
    function resize() {
      renderer.setSize(element!.clientWidth || 88, element!.clientHeight || 88);
      lastPose = "";
    }
    const observer = new ResizeObserver(resize); observer.observe(element);
    resize(); renderer.render(scene, camera); setReady(true);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      geometries.forEach(geometry => geometry.dispose());
      [ivory, teal, face, blue, coral].forEach(material => material.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <span className="robot-mascot" ref={host} aria-hidden="true" data-mood={mood}>{!ready ? <Bot size={40} /> : null}</span>;
}
