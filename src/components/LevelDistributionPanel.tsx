import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Minus,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Target,
} from 'lucide-react';
import { JLPTLevel, LevelWeights } from '../types';
import {
  DEFAULT_LEVEL_WEIGHTS,
  JLPT_LEVELS,
  LEVEL_METADATA,
  STRICT_LEVEL_WEIGHTS,
} from '../utils/vocabData';

interface LevelDistributionPanelProps {
  selectedLevel: JLPTLevel;
  weights: LevelWeights;
  useSmartMix: boolean;
  onChangeWeights: (weights: LevelWeights, isSmartMix: boolean) => void;
}

// Convert weights to 5 cut positions on the bar (0 to 100)
// cuts = [0, c1, c2, c3, c4, 100]
const getCutsFromWeights = (w: LevelWeights): number[] => {
  const c0 = 0;
  const c1 = Math.max(0, w.N5 || 0);
  const c2 = c1 + Math.max(0, w.N4 || 0);
  const c3 = c2 + Math.max(0, w.N3 || 0);
  const c4 = c3 + Math.max(0, w.N2 || 0);
  return [c0, c1, c2, c3, c4, 100];
};

// Adjust one level's weight and balance the difference with others, always maintaining 100%
function adjustLevelWeight(
  currentWeights: LevelWeights,
  targetLevel: JLPTLevel,
  targetValue: number,
  orderedLevels: JLPTLevel[]
): LevelWeights {
  const targetVal = Math.max(0, Math.min(100, Math.round(targetValue)));
  const currentVal = currentWeights[targetLevel] ?? 0;
  const diff = targetVal - currentVal;
  if (diff === 0) return currentWeights;

  const result: LevelWeights = { ...currentWeights, [targetLevel]: targetVal };
  const otherLevels = orderedLevels.filter((lvl) => lvl !== targetLevel);

  if (diff > 0) {
    let remainingToDeduct = diff;
    const candidates = [...otherLevels]
      .filter((lvl) => (result[lvl] || 0) > 0)
      .sort((a, b) => (result[b] || 0) - (result[a] || 0));

    for (const lvl of candidates) {
      if (remainingToDeduct <= 0) break;
      const canDeduct = Math.min(result[lvl] || 0, remainingToDeduct);
      result[lvl] -= canDeduct;
      remainingToDeduct -= canDeduct;
    }
    if (remainingToDeduct > 0) {
      result[targetLevel] -= remainingToDeduct;
    }
  } else {
    let remainingToAdd = Math.abs(diff);
    const activeOthers = otherLevels.filter((lvl) => (result[lvl] || 0) > 0);
    const targetAddLevels = activeOthers.length > 0 ? activeOthers : otherLevels;

    for (let i = 0; remainingToAdd > 0 && i < targetAddLevels.length; i++) {
      const lvl = targetAddLevels[i];
      const add = Math.min(
        100 - (result[lvl] || 0),
        Math.ceil(remainingToAdd / (targetAddLevels.length - i))
      );
      result[lvl] = (result[lvl] || 0) + add;
      remainingToAdd -= add;
    }
  }

  // Ensure exact 100% total
  const sum = orderedLevels.reduce((acc, lvl) => acc + (result[lvl] || 0), 0);
  if (sum !== 100) {
    const error = 100 - sum;
    if (result[targetLevel] + error >= 0 && result[targetLevel] + error <= 100) {
      result[targetLevel] += error;
    } else {
      let maxLvl = orderedLevels[0];
      for (const lvl of orderedLevels) {
        if ((result[lvl] || 0) > (result[maxLvl] || 0)) maxLvl = lvl;
      }
      result[maxLvl] = Math.max(0, result[maxLvl] + error);
    }
  }

  return result;
}

export const LevelDistributionPanel: React.FC<LevelDistributionPanelProps> = ({
  selectedLevel,
  weights,
  useSmartMix,
  onChangeWeights,
}) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<number | null>(null);

  // Drag state ref for ultra-smooth 60fps tracking without lag or stale closures
  const dragStateRef = useRef<{
    handleIdx: number;
    barRect: DOMRect;
    initialCuts: number[];
  } | null>(null);

  // Order consistently from N5 (beginner) to N1 (advanced)
  const orderedLevels = useMemo<JLPTLevel[]>(
    () => ['N5', 'N4', 'N3', 'N2', 'N1'],
    []
  );

  // Cut points on the bar (0 to 100)
  const cuts = useMemo(() => getCutsFromWeights(weights), [weights]);

  const totalWeight = useMemo(
    () => JLPT_LEVELS.reduce((sum, lvl) => sum + (weights[lvl] || 0), 0),
    [weights]
  );

  const isStrictMode =
    !useSmartMix &&
    !isCustomizing &&
    weights[selectedLevel] === 100 &&
    totalWeight === 100;

  const handleSelectSmartMix = () => {
    setIsCustomizing(false);
    onChangeWeights({ ...DEFAULT_LEVEL_WEIGHTS[selectedLevel] }, true);
  };

  const handleSelectStrict = () => {
    setIsCustomizing(false);
    onChangeWeights({ ...STRICT_LEVEL_WEIGHTS[selectedLevel] }, false);
  };

  // Direct percentage input: auto-balances with other levels to maintain 100%
  const handleDirectNumberInput = (lvl: JLPTLevel, val: number) => {
    const next = adjustLevelWeight(weights, lvl, val, orderedLevels);
    setIsCustomizing(true);
    onChangeWeights(next, false);
  };

  // Step button (+5% / -5%): auto-balances with other levels to maintain 100%
  const handleStepWeight = (lvl: JLPTLevel, delta: number) => {
    const current = weights[lvl] ?? 0;
    const nextVal = current + delta;
    const next = adjustLevelWeight(weights, lvl, nextVal, orderedLevels);
    setIsCustomizing(true);
    onChangeWeights(next, false);
  };

  // Draggable divider handle on pointer down (works for both mouse & touch)
  const handleDragStart = (handleIdx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    dragStateRef.current = {
      handleIdx,
      barRect: rect,
      initialCuts: getCutsFromWeights(weights),
    };
    setDraggingHandle(handleIdx);
    setIsCustomizing(true);
  };

  // Drag tracking: moves the divider directly and updates percentage numbers live
  useEffect(() => {
    if (draggingHandle === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !barRef.current) return;
      const { handleIdx, barRect, initialCuts } = state;
      if (barRect.width <= 0) return;

      const rawPct = ((e.clientX - barRect.left) / barRect.width) * 100;
      const clampedPct = Math.round(Math.max(0, Math.min(100, rawPct)));

      const cutIdx = handleIdx + 1;
      const nextCuts = [...initialCuts];
      nextCuts[cutIdx] = clampedPct;

      // Push left cuts if they exceed clampedPct
      for (let i = 1; i < cutIdx; i++) {
        if (nextCuts[i] > clampedPct) {
          nextCuts[i] = clampedPct;
        }
      }

      // Push right cuts if they are below clampedPct
      for (let i = cutIdx + 1; i <= 4; i++) {
        if (nextCuts[i] < clampedPct) {
          nextCuts[i] = clampedPct;
        }
      }

      const nextWeights: LevelWeights = {
        N5: nextCuts[1] - nextCuts[0],
        N4: nextCuts[2] - nextCuts[1],
        N3: nextCuts[3] - nextCuts[2],
        N2: nextCuts[4] - nextCuts[3],
        N1: nextCuts[5] - nextCuts[4],
      };

      onChangeWeights(nextWeights, false);
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDraggingHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingHandle, onChangeWeights]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 backdrop-blur-sm space-y-3.5">
      {/* Header & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-100">
            สัดส่วนการสุ่ม ({selectedLevel})
          </h3>
        </div>

        {/* Mode Preset Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleSelectSmartMix}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              useSmartMix && !isCustomizing
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            ผสมสมดุล
          </button>

          {selectedLevel !== 'N5' && (
            <button
              type="button"
              onClick={handleSelectStrict}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isStrictMode
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              เฉพาะ {selectedLevel} 100%
            </button>
          )}

          {isCustomizing && (
            <button
              type="button"
              onClick={handleSelectSmartMix}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          )}
        </div>
      </div>

      {/* Interactive Multi-segment Bar with Draggable Dividers */}
      <div>
        {/* The Bar */}
        <div
          ref={barRef}
          className="relative h-9 w-full rounded-2xl bg-slate-950 border border-slate-800 p-0.5 flex overflow-hidden select-none touch-none shadow-inner"
        >
          {orderedLevels.map((lvl) => {
            const pct = weights[lvl] ?? 0;
            if (pct <= 0) return null;
            const meta = LEVEL_METADATA[lvl];
            return (
              <div
                key={lvl}
                style={{ width: `${pct}%` }}
                className={`${meta.barColor} h-full flex items-center justify-center overflow-hidden relative select-none ${
                  draggingHandle !== null ? '' : 'transition-[width] duration-150'
                }`}
                title={`${lvl}: ${pct}%`}
              >
                {pct >= 8 && (
                  <span className="text-xs font-black text-slate-950 drop-shadow-xs whitespace-nowrap px-1 select-none pointer-events-none">
                    {lvl} {pct}%
                  </span>
                )}
              </div>
            );
          })}

          {/* Draggable Divider Handles (between N5|N4, N4|N3, N3|N2, N2|N1) */}
          {[0, 1, 2, 3].map((handleIdx) => {
            const pos = cuts[handleIdx + 1];
            const isDragging = draggingHandle === handleIdx;
            // Prioritize handles at extremes so stacked handles can be pulled apart
            const baseZ = pos <= 50 ? 25 - handleIdx : 21 + handleIdx;
            const zIndex = isDragging ? 35 : baseZ;

            return (
              <div
                key={handleIdx}
                style={{ left: `${pos}%`, zIndex }}
                onPointerDown={(e) => handleDragStart(handleIdx, e)}
                className="absolute top-0 bottom-0 -ml-3 w-6 flex items-center justify-center cursor-ew-resize group touch-none select-none"
                title={`ลากปรับสัดส่วนระหว่าง ${orderedLevels[handleIdx]} และ ${orderedLevels[handleIdx + 1]}`}
              >
                <div
                  className={`w-1.5 h-6 rounded-full transition-transform ${
                    isDragging
                      ? 'bg-white ring-2 ring-rose-500 scale-125 shadow-lg shadow-rose-500/50'
                      : 'bg-white/90 group-hover:bg-white group-hover:scale-110 shadow-md border border-slate-900'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Level Cards with Direct Number Input & Steppers */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {orderedLevels.map((lvl) => {
          const val = weights[lvl] ?? 0;
          const meta = LEVEL_METADATA[lvl];
          const isSelected = selectedLevel === lvl;

          return (
            <div
              key={lvl}
              className={`rounded-2xl p-2.5 sm:p-3 border transition-all flex flex-col justify-between gap-2 ${
                val > 0
                  ? `${meta.badgeClass} ring-1 ring-white/10`
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black">{lvl}</span>
                  {isSelected && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-bold">
                      หลัก
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold opacity-75">
                  {meta.subtitle}
                </span>
              </div>

              {/* Direct Number Input + Steppers */}
              <div className="flex items-center justify-between gap-1 bg-slate-950/90 rounded-xl p-1 border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleStepWeight(lvl, -5)}
                  disabled={val <= 0}
                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all disabled:opacity-20 cursor-pointer"
                  title="ลด 5%"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <div className="flex items-center justify-center flex-1 min-w-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={val}
                    onChange={(e) =>
                      handleDirectNumberInput(lvl, Number(e.target.value))
                    }
                    className="w-full text-center font-mono font-extrabold text-sm sm:text-base text-white bg-transparent outline-none p-0 focus:text-rose-400"
                  />
                  <span className="text-xs font-bold text-slate-400 select-none">%</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepWeight(lvl, 5)}
                  disabled={val >= 100}
                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all disabled:opacity-20 cursor-pointer"
                  title="เพิ่ม 5%"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
