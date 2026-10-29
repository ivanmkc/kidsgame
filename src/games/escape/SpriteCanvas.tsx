import React, { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { EscapeRoom } from "../../manifest";
import { EscapeState, isHotspotAvailable } from "./logic";

export interface SpriteAnim {
  hotspotId: string;
  playing: boolean;
  held: boolean;
  frameIndex: number;
}

interface SpriteEntry {
  hotspotId: string;
  playing: boolean;
  held: boolean;
  frameIndex: number;
  accumulator: number;
}

export function SpriteCanvas({
  room,
  state,
  anims,
  setAnims,
  scale,
}: {
  room: EscapeRoom;
  state: EscapeState;
  anims: SpriteAnim[];
  setAnims: React.Dispatch<React.SetStateAction<SpriteAnim[]>>;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetsRef = useRef<Record<string, HTMLImageElement>>({});
  const restRef = useRef<Record<string, HTMLImageElement>>({});
  // Item layers are rendered as DOM <img> elements, not on the canvas.
  const rafRef = useRef<number>(0);
  const entriesRef = useRef<SpriteEntry[]>([]);
  const lastTimeRef = useRef<number>(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const stateRef = useRef(state);
  stateRef.current = state;
  const setAnimsRef = useRef(setAnims);
  setAnimsRef.current = setAnims;
  const needsRedrawRef = useRef(false);
  const drawStaticRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    sheetsRef.current = {};
    restRef.current = {};

    for (const h of room.hotspots) {
      if (!h.sprite) continue;
      if (h.sprite.sheet) {
        const img = new window.Image();
        img.src = h.sprite.sheet;
        img.onload = () => {
          needsRedrawRef.current = true;
          if (!rafRef.current) drawStaticRef.current?.();
        };
        sheetsRef.current[h.id] = img;
      }
      if (h.sprite.rest) {
        const img = new window.Image();
        img.src = h.sprite.rest;
        img.onload = () => {
          needsRedrawRef.current = true;
          if (!rafRef.current) drawStaticRef.current?.();
        };
        restRef.current[h.id] = img;
      }
    }
  }, [room]);

  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = scaleRef.current;
    const rm = roomRef.current;
    const st = stateRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr =
      (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;
    ctx.scale(dpr, dpr);

    for (const h of rm.hotspots) {
      if (!h.sprite) continue;
      if (!isHotspotAvailable(rm, st, h.id)) continue;
      const sp = h.sprite;
      const isUsed = st.used.includes(h.id);
      const isRevealed = st.revealed.includes(h.id);
      const hasRestLayer = Boolean(sp.rest && sp.restBbox);

      // Clean-plate model: rest layer drawn for untouched hotspots,
      // sprite last frame for revealed/used, item layer for revealed
      const entry = entriesRef.current.find((e) => e.hotspotId === h.id);

      if (!isUsed && !isRevealed && !entry) {
        if (hasRestLayer) {
          const rest = restRef.current[h.id];
          if (rest?.naturalWidth && sp.restBbox) {
            ctx.drawImage(
              rest,
              sp.restBbox.x * s,
              sp.restBbox.y * s,
              sp.restBbox.w * s,
              sp.restBbox.h * s,
            );
          }
        }
        continue;
      }

      if (entry) {
        if (!sp.sheet || !sp.cols || !sp.frameCount) continue;
        const sheet = sheetsRef.current[h.id];
        if (!sheet?.naturalWidth) continue;
        const frameW = sheet.naturalWidth / sp.cols;
        const rows = Math.ceil(sp.frameCount / sp.cols);
        const frameH = sheet.naturalHeight / rows;
        const col = entry.frameIndex % sp.cols;
        const row = Math.floor(entry.frameIndex / sp.cols);
        ctx.drawImage(
          sheet,
          col * frameW,
          row * frameH,
          frameW,
          frameH,
          sp.bbox.x * s,
          sp.bbox.y * s,
          sp.bbox.w * s,
          sp.bbox.h * s,
        );
      } else if ((isUsed || isRevealed) && sp.sheet) {
        const sheet = sheetsRef.current[h.id];
        if (sheet?.naturalWidth && sp.cols && sp.frameCount) {
          const frameW = sheet.naturalWidth / sp.cols;
          const rows = Math.ceil(sp.frameCount / sp.cols);
          const frameH = sheet.naturalHeight / rows;
          const lastIdx = sp.frameCount - 1;
          const col = lastIdx % sp.cols;
          const row = Math.floor(lastIdx / sp.cols);
          ctx.drawImage(
            sheet,
            col * frameW,
            row * frameH,
            frameW,
            frameH,
            sp.bbox.x * s,
            sp.bbox.y * s,
            sp.bbox.w * s,
            sp.bbox.h * s,
          );
        }
      }
    }
  }, []);
  drawStaticRef.current = drawStatic;

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    lastTimeRef.current = 0;
    const tick = (timestamp: number) => {
      const dt = lastTimeRef.current
        ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
        : 0;
      lastTimeRef.current = timestamp;

      let anyPlaying = false;
      let anyCompleted = false;

      for (const entry of entriesRef.current) {
        const h = roomRef.current.hotspots.find(
          (x) => x.id === entry.hotspotId,
        );
        if (
          !h?.sprite?.sheet ||
          !h.sprite.cols ||
          !h.sprite.frameCount ||
          !h.sprite.fps
        )
          continue;
        const { fps, frameCount } = h.sprite;
        const sheet = sheetsRef.current[h.id];
        if (!sheet?.naturalWidth) {
          if (entry.playing) anyPlaying = true;
          continue;
        }

        if (entry.playing) {
          if (dt > 0) {
            const frameDuration = 1 / fps;
            entry.accumulator += dt;
            while (entry.accumulator >= frameDuration) {
              entry.accumulator -= frameDuration;
              entry.frameIndex++;
            }
            if (entry.frameIndex >= frameCount - 1) {
              entry.frameIndex = frameCount - 1;
              entry.playing = false;
              entry.held = true;
              anyCompleted = true;
            }
          }
          if (entry.playing) anyPlaying = true;
        }
      }

      drawStatic();

      if (anyCompleted) {
        setAnimsRef.current((prev) =>
          prev.map((a) => {
            const entry = entriesRef.current.find(
              (e) => e.hotspotId === a.hotspotId,
            );
            if (entry && entry.held) {
              return {
                ...a,
                playing: false,
                held: true,
                frameIndex: entry.frameIndex,
              };
            }
            return a;
          }),
        );
      }

      if (anyPlaying) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawStatic]);

  useEffect(() => {
    if (anims.length === 0) {
      entriesRef.current = [];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      lastTimeRef.current = 0;
      needsRedrawRef.current = true;
    } else {
      const existing = new Set(entriesRef.current.map((e) => e.hotspotId));
      let added = false;
      for (const a of anims) {
        if (a.playing && !existing.has(a.hotspotId)) {
          entriesRef.current.push({
            hotspotId: a.hotspotId,
            playing: true,
            held: false,
            frameIndex: 0,
            accumulator: 0,
          });
          added = true;
        }
      }
      const validIds = new Set(anims.map((a) => a.hotspotId));
      entriesRef.current = entriesRef.current.filter((e) =>
        validIds.has(e.hotspotId),
      );
      if (added) startLoop();
      else needsRedrawRef.current = true;
    }
  }, [anims, startLoop]);

  useEffect(() => {
    needsRedrawRef.current = true;
  }, [state.used.length, state.revealed.length, scale]);

  useEffect(() => {
    if (!needsRedrawRef.current) return;
    needsRedrawRef.current = false;
    if (!rafRef.current) drawStatic();
  });

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  if (Platform.OS !== "web") return null;
  const w = Math.round(1280 * scale);
  const h = Math.round(720 * scale);
  const dpr =
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;
  return React.createElement("canvas", {
    ref: canvasRef,
    width: Math.round(w * dpr),
    height: Math.round(h * dpr),
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      width: w,
      height: h,
      pointerEvents: "none",
    },
  });
}
