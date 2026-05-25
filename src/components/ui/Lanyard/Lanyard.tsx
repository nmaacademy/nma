/* eslint-disable react/no-unknown-property */
import { createElement, useEffect, useRef, useState } from "react";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RigidBodyProps,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";

import cardGLB from "./card.glb";
import lanyardTexture from "./lanyard.png";
import "./Lanyard.css";

extend({ MeshLineGeometry, MeshLineMaterial });

interface LanyardProps {
  className?: string;
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
}

export default function Lanyard({
  className = "",
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`lanyard-wrapper ${className}`} aria-hidden="true">
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)
        }
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

interface BandProps {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
}

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false }: BandProps) {
  const band = useRef<any>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);
  const hoverInfluence = useRef(new THREE.Vector2(0, 0));
  const pendingMobileDrag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    offset: THREE.Vector3;
  } | null>(null);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const getPointerClientPosition = (event: any) => ({
    x: event.clientX ?? event.nativeEvent?.clientX ?? event.sourceEvent?.clientX ?? 0,
    y: event.clientY ?? event.nativeEvent?.clientY ?? event.sourceEvent?.clientY ?? 0,
  });
  const getPointerMovement = (event: any) => ({
    x: event.movementX ?? event.nativeEvent?.movementX ?? event.sourceEvent?.movementX ?? 0,
    y: event.movementY ?? event.nativeEvent?.movementY ?? event.sourceEvent?.movementY ?? 0,
  });

  const segmentProps = {
    type: "dynamic" as RigidBodyProps["type"],
    canSleep: true,
    colliders: false as const,
    angularDamping: isMobile ? 6 : 4,
    linearDamping: isMobile ? 6 : 4,
  } satisfies Partial<RigidBodyProps>;

  const { nodes, materials } = useGLTF(cardGLB) as any;
  const texture = useTexture(lanyardTexture);
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [
    [0, 0, 0],
    [0, 0, 0],
    1,
  ]);
  useRopeJoint(j1, j2, [
    [0, 0, 0],
    [0, 0, 0],
    1,
  ]);
  useRopeJoint(j2, j3, [
    [0, 0, 0],
    [0, 0, 0],
    1,
  ]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0],
  ]);

  useEffect(() => {
    if (!hovered) return;

    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }

    if (!fixed.current) return;

    [j1, j2].forEach((ref) => {
      if (!ref.current.lerped) {
        ref.current.lerped = new THREE.Vector3().copy(
          ref.current.translation(),
        );
      }

      const clampedDistance = Math.max(
        0.1,
        Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())),
      );
      const speedRange = isMobile ? maxSpeed * 0.48 : maxSpeed;
      ref.current.lerped.lerp(
        ref.current.translation(),
        delta * (minSpeed + clampedDistance * (speedRange - minSpeed)),
      );
    });

    curve.points[0].copy(j3.current.translation());
    curve.points[1].copy(j2.current.lerped);
    curve.points[2].copy(j1.current.lerped);
    curve.points[3].copy(fixed.current.translation());
    band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
    ang.copy(card.current.angvel());
    rot.copy(card.current.rotation());

    const idleTime = state.clock.elapsedTime;
    const mobileIdleFactor = isMobile ? 0.35 : 1;
    const idleSway = !dragged
      ? Math.sin(idleTime * 0.58) * 0.09 * mobileIdleFactor
      : 0;
    const idleTwist = !dragged
      ? Math.sin(idleTime * 0.48) * 0.11 * mobileIdleFactor
      : 0;
    const idleTilt = !dragged
      ? Math.cos(idleTime * 0.42) * 0.035 * mobileIdleFactor
      : 0;
    hoverInfluence.current.lerp(new THREE.Vector2(0, 0), delta * 4.5);

    if (!dragged) {
      const lin = card.current.linvel();
      card.current.wakeUp();
      card.current.setLinvel(
        { x: idleSway + hoverInfluence.current.x, y: lin.y, z: lin.z },
        true,
      );
    }

    card.current.setAngvel({
      x: ang.x + idleTilt - hoverInfluence.current.y * 0.6,
      y: ang.y - rot.y * 0.25 + idleTwist + hoverInfluence.current.x * 1.15,
      z: ang.z + idleTilt * 0.65 - hoverInfluence.current.y * 0.45,
    });
  });

  curve.curveType = "chordal";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody
          ref={fixed}
          {...segmentProps}
          type={"fixed" as RigidBodyProps["type"]}
        />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={
            dragged
              ? ("kinematicPosition" as RigidBodyProps["type"])
              : ("dynamic" as RigidBodyProps["type"])
          }
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => {
              hover(true);
              card.current?.wakeUp();
            }}
            onPointerOut={() => {
              hover(false);
              hoverInfluence.current.set(0, 0);
            }}
            onPointerUp={(event: any) => {
              if (event.target.hasPointerCapture?.(event.pointerId)) {
                event.target.releasePointerCapture(event.pointerId);
              }
              pendingMobileDrag.current = null;
              drag(false);
            }}
            onPointerDown={(event: any) => {
              const offset = new THREE.Vector3()
                .copy(event.point)
                .sub(vec.copy(card.current.translation()));

              if (isMobile) {
                const pointerPosition = getPointerClientPosition(event);
                pendingMobileDrag.current = {
                  pointerId: event.pointerId,
                  x: pointerPosition.x,
                  y: pointerPosition.y,
                  offset,
                };
                return;
              }

              event.target.setPointerCapture(event.pointerId);
              drag(offset);
            }}
            onPointerMove={(event: any) => {
              const pending = pendingMobileDrag.current;

              if (!isMobile && hovered && !dragged) {
                const movement = getPointerMovement(event);
                hoverInfluence.current.set(
                  THREE.MathUtils.clamp(movement.x * 0.018, -0.28, 0.28),
                  THREE.MathUtils.clamp(movement.y * 0.014, -0.18, 0.18),
                );
                card.current?.wakeUp();
              }

              if (!isMobile || !pending || dragged) return;

              const pointerPosition = getPointerClientPosition(event);
              const deltaX = pointerPosition.x - pending.x;
              const deltaY = pointerPosition.y - pending.y;
              const horizontalIntent =
                Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
              const verticalIntent =
                Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX);

              if (horizontalIntent) {
                event.target.setPointerCapture(event.pointerId);
                drag(pending.offset);
                pendingMobileDrag.current = null;
              } else if (verticalIntent) {
                pendingMobileDrag.current = null;
              }
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={materials.base.map}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh
              geometry={nodes.clip.geometry}
              material={materials.metal}
              material-roughness={0.3}
            />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        {createElement("meshLineGeometry")}
        {createElement("meshLineMaterial", {
          color: "white",
          depthTest: false,
          resolution: isMobile ? [1000, 2000] : [1000, 1000],
          useMap: true,
          map: texture,
          repeat: [-4, 1],
          lineWidth: 1,
        })}
      </mesh>
    </>
  );
}
