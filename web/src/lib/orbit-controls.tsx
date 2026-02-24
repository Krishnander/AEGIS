"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Camera } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls as OrbitControlsModule } from "three-stdlib";

type OrbitControlsProps = {
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
};

const toCamera = (camera: Camera) => camera as OrbitControlsImpl["object"];

export function OrbitControls({ enablePan = true, minDistance, maxDistance }: OrbitControlsProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const controls = useMemo(() => new OrbitControlsModule(toCamera(camera), gl.domElement), [camera, gl.domElement]);

  useEffect(() => {
    controls.enablePan = enablePan;
    if (minDistance !== undefined) controls.minDistance = minDistance;
    if (maxDistance !== undefined) controls.maxDistance = maxDistance;
    controlsRef.current = controls;
    return () => controls.dispose();
  }, [controls, enablePan, minDistance, maxDistance]);

  useFrame(() => controls.update());

  return null;
}

export default OrbitControls;
