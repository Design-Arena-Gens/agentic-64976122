"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { createAudioEngine } from "../components/AudioEngine";

const Scene = dynamic(() => import("../components/GlassWatermelonScene"), {
  ssr: false,
});

export default function Page() {
  const [soundReady, setSoundReady] = useState(false);
  const audioEngineRef = useRef(null);

  useEffect(() => {
    audioEngineRef.current = createAudioEngine();
  }, []);

  const onStart = async () => {
    if (!audioEngineRef.current) return;
    await audioEngineRef.current.start();
    setSoundReady(true);
  };

  return (
    <main className={styles.main}>
      {!soundReady && (
        <button className={styles.start} onClick={onStart} aria-label="Start">
          Click to enable ASMR sound
        </button>
      )}
      <div className={styles.canvasWrap} aria-label="Cinematic Scene">
        <Scene
          width={1280}
          height={720}
          dpr={1.5}
          onSliceSound={(type) => {
            if (!audioEngineRef.current || !soundReady) return;
            if (type === "slice") audioEngineRef.current.playSlice();
            if (type === "crack") audioEngineRef.current.playCrack();
            if (type === "shards") audioEngineRef.current.playShards();
          }}
        />
      </div>
    </main>
  );
}

