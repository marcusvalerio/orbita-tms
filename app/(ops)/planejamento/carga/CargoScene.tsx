"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CargoItem, PlacedBox, Vehicle3D } from "@/lib/planning/cargo";

// Cena 3D do baú. Unidade: cm → 1 unidade = 1 cm, câmera ajustada ao veículo.
// Clique numa caixa para selecioná-la (callback onPick).

export function CargoScene({
  vehicle,
  boxes,
  items,
  selectedItemId,
  onPick,
}: {
  vehicle: Vehicle3D;
  boxes: PlacedBox[];
  items: CargoItem[];
  selectedItemId: string | null;
  onPick: (box: PlacedBox | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { length: L, width: W, height: H } = vehicle;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);
    const span = Math.max(L, W * 3);
    camera.position.set(L * 1.1, H * 2.2, W * 2.6 + span * 0.35);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(L / 2, H / 3, W / 2);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(L, H * 4, W * 3);
    scene.add(sun);

    // Piso do baú, contorno, cabine (x < 0) e marcação da porta (x = L).
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 4, W), new THREE.MeshStandardMaterial({ color: 0x9ca3af }));
    floor.position.set(L / 2, -2, W / 2);
    scene.add(floor);
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)),
      new THREE.LineBasicMaterial({ color: 0x6b7280 })
    );
    shell.position.set(L / 2, H / 2, W / 2);
    scene.add(shell);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(160, H * 0.8, W), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    cab.position.set(-90, H * 0.4, W / 2);
    scene.add(cab);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
    );
    door.rotation.y = Math.PI / 2;
    door.position.set(L, H / 2, W / 2);
    scene.add(door);

    const byId = new Map(items.map((i) => [i.id, i]));
    const meshes: THREE.Mesh[] = [];
    for (const b of boxes) {
      const item = byId.get(b.itemId);
      const dim = selectedItemId && selectedItemId !== b.itemId;
      const mat = new THREE.MeshStandardMaterial({
        color: item?.color ?? 0x888888,
        transparent: !!dim,
        opacity: dim ? 0.18 : 1,
        emissive: selectedItemId === b.itemId ? 0x222222 : 0x000000,
      });
      const isDrum = item?.kind === "tambor";
      const geo = isDrum
        ? new THREE.CylinderGeometry(Math.min(b.dx, b.dz) / 2 - 1, Math.min(b.dx, b.dz) / 2 - 1, b.dy - 1, 24)
        : new THREE.BoxGeometry(b.dx - 1, b.dy - 1, b.dz - 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x + b.dx / 2, b.y + b.dy / 2, b.z + b.dz / 2);
      mesh.userData.box = b;
      if (!isDrum) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: dim ? 0.08 : 0.35 }));
        mesh.add(edges);
      }
      scene.add(mesh);
      meshes.push(mesh);
    }

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Clique sem arrastar = seleção.
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      pickRef.current(hit ? (hit.object.userData.box as PlacedBox) : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [vehicle, boxes, items, selectedItemId]);

  return <div ref={hostRef} className="h-full w-full" aria-label="Visualização 3D do baú. Arraste para girar, role para aproximar e clique numa carga para ver detalhes." role="img" />;
}
