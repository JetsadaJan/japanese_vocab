import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Minus,
  MoveHorizontal,
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

export const LevelDistributionPanel: React.FC<LevelDistributionPanelProps> = ({
  selectedLevel,
  weights,
  useSmartMix,
  onChangeWeights,
}) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<number | null>(null);

  // Order consistently from N5 (beginner) to N1 (advanced)
  const orderedLevels = useMemo<JLPTLevel[]>(() => ['N5', 'N4', 'N3', 'N2', 'N1'], []);

  const totalWeight = useMemo(
    () => JLPT_LEVELS.reduce((sum, lvl) => sum + (weights[lvl] || 0), 0),
    [weights]
  );

  const getNormalizedPercent = useCallback(
    (lvl: JLPTLevel): number => {
      if (totalWeight <= 0) return lvl === selectedLevel ? 100 : 0;
      return Math.round(((weights[lvl] || 0) / totalWeight) * 100);
    },
    [selectedLevel, totalWeight, weights]
  );

  // Normalizes percentages to sum to exactly 100 for the visual bar segments
  const normalizedPercents = useMemo(() => {
    const raw = orderedLevels.map((lvl) => getNormalizedPercent(lvl));
    const rawSum = raw.reduce((a, b) => a + b, 0);
    if (rawSum !== 100 && rawSum > 0) {
      const diff = 100 - rawSum;
      let maxIdx = 0;
      for (let i = 1; i < raw.length; i++) {
        if (raw[i] > raw[maxIdx]) maxIdx = i;
      }
      raw[maxIdx] += diff;
    }
    return raw;
  }, [orderedLevels, getNormalizedPercent]);

  // Cumulative positions (cuts) from 0 to 100
  const cuts = useMemo(() => {
    const res = [0];
    let sum = 0;
    for (let i = 0; i < normalizedPercents.length; i++) {
      sum += normalizedPercents[i];
      res.push(sum);
    }
    res[res.length - 1] = 100;
    return res;
  }, [normalizedPercents]);

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

  // Direct percentage input by user
  const handleDirectNumberInput = (lvl: JLPTLevel, val: number) => {
    const clamped = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
    const next = { ...weights, [lvl]: clamped };
    setIsCustomizing(true);
    onChangeWeights(next, false);
  };

  // Step button (+5% / -5%)
  const handleStepWeight = (lvl: JLPTLevel, delta: number) => {
    const current = weights[lvl] ?? 0;
    const nextVal = Math.max(0, Math.min(100, current + delta));
    const next = { ...weights, [lvl]: nextVal };
    setIsCustomizing(true);
    onChangeWeights(next, false);
  };

  // Auto-balance weights so they total 100%
  const handleAutoBalance = () => {
    if (totalWeight <= 0) {
      onChangeWeights({ ...DEFAULT_LEVEL_WEIGHTS[selectedLevel] }, true);
      return;
    }
    const balanced: LevelWeights = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    let sum = 0;
    orderedLevels.forEach((lvl) => {
      const pct = Math.round(((weights[lvl] || 0) / totalWeight) * 100);
      balanced[lvl] = pct;
      sum += pct;
    });
    if (sum !== 100 && sum > 0) {
      const diff = 100 - sum;
      balanced[selectedLevel] = Math.max(0, balanced[selectedLevel] + diff);
    }
    setIsCustomizing(true);
    onChangeWeights(balanced, false);
  };

  // Draggable divider handle handlers on the visual bar
  const handleDragStart = (handleIdx: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDraggingHandle(handleIdx);
    setIsCustomizing(true);
  };

  useEffect(() => {
    if (draggingHandle === null) return;

    const handleMove = (clientX: number) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const rawPct = ((clientX - rect.left) / rect.width) * 100;
      const minPct = cuts[draggingHandle];
      const maxPct = cuts[draggingHandle + 2];
      const clamped = Math.round(Math.max(minPct, Math.min(maxPct, rawPct)));

      const leftLevel = orderedLevels[draggingHandle];
      const rightLevel = orderedLevels[draggingHandle + 1];

      const newLeftWeight = clamped - minPct;
      const newRightWeight = maxPct - clamped;

      const nextWeights = { ...weights };
      nextWeights[leftLevel] = newLeftWeight;
      nextWeights[rightLevel] = newRightWeight;

      onChangeWeights(nextWeights, false);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };

    const onEnd = () => setDraggingHandle(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [draggingHandle, cuts, orderedLevels, weights, onChangeWeights]);

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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="flex items-center gap-1 text-slate-400 font-medium">
            <MoveHorizontal className="w-3.5 h-3.5 text-rose-400" />
            ลากเส้นแบ่งบนแถบ หรือพิมพ์เปอร์เซ็นต์ในช่องด้านล่าง
          </span>

          {totalWeight === 100 ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold">
              <Check className="w-3.5 h-3.5" /> รวม 100% ครบถ้วน
            </span>
          ) : (
            <button
              type="button"
              onClick={handleAutoBalance}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
            >
              รวม {totalWeight}% (กดเพื่อปรับให้ครบ 100%)
            </button>
          )}
        </div>

        {/* The Bar */}
        <div
          ref={barRef}
          className="relative h-9 w-full rounded-2xl bg-slate-950 border border-slate-800 p-0.5 flex overflow-hidden select-none touch-none shadow-inner"
        >
          {orderedLevels.map((lvl, idx) => {
            const pct = normalizedPercents[idx];
            if (pct <= 0) return null;
            const meta = LEVEL_METADATA[lvl];
            return (
              <div
                key={lvl}
                style={{ width: `${pct}%` }}
                className={`${meta.barColor} h-full transition-all duration-75 flex items-center justify-center overflow-hidden relative`}
                title={`${lvl}: ${pct}%`}
              >
                {pct >= 8 && (
                  <span className="text-xs font-black text-slate-950 drop-shadow-xs whitespace-nowrap px-1">
                    {lvl} {pct}%
                  </span>
                )}
              </div>
            );
          })}

          {/* Draggable Divider Handles (between N5|N4, N4|N3, N3|N2, N2|N1) */}
          {[0, 1, 2, 3].map((handleIdx) => {
            const pos = cuts[handleIdx + 1];
            if (pos <= 0 || pos >= 100) return null;
            const isDragging = draggingHandle === handleIdx;

            return (
              <div
                key={handleIdx}
                style={{ left: `${pos}%` }}
                onMouseDown={(e) => handleDragStart(handleIdx, e)}
                onTouchStart={(e) => handleDragStart(handleIdx, e)}
                className="absolute top-0 bottom-0 -ml-2.5 w-5 flex items-center justify-center cursor-ew-resize z-20 group"
                title={`ลากปรับสัดส่วนระหว่าง ${orderedLevels[handleIdx]} และ ${orderedLevels[handleIdx + 1]}`}
              >
                <div
                  className={`w-1.5 h-6 rounded-full transition-all ${
                    isDragging
                      ? 'bg-white ring-2 ring-rose-500 scale-125 shadow-lg'
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
        {orderedLevels.map((lvl, idx) => {
          const pct = normalizedPercents[idx];
          const rawVal = weights[lvl] ?? 0;
          const meta = LEVEL_METADATA[lvl];
          const isSelected = selectedLevel === lvl;

          return (
            <div
              key={lvl}
              className={`rounded-2xl p-2.5 sm:p-3 border transition-all flex flex-col justify-between gap-2 ${
                rawVal > 0
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
                <span className="text-[11px] font-medium opacity-80 font-mono">
                  คำนวณ {pct}%
                </span>
              </div>

              {/* Direct Number Input + Steppers */}
              <div className="flex items-center justify-between gap-1 bg-slate-950/90 rounded-xl p-1 border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleStepWeight(lvl, -5)}
                  disabled={rawVal <= 0}
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
                    value={rawVal}
                    onChange={(e) => handleDirectNumberInput(lvl, Number(e.target.value))}
                    className="w-full text-center font-mono font-extrabold text-sm sm:text-base text-white bg-transparent outline-none p-0 focus:text-rose-400"
                  />
                  <span className="text-xs font-bold text-slate-400 select-none">%</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepWeight(lvl, 5)}
                  disabled={rawVal >= 100}
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
