import React, { useState } from 'react';
import { Sliders, Sparkles, Target, RotateCcw } from 'lucide-react';
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

  const totalWeight = JLPT_LEVELS.reduce((sum, lvl) => sum + (weights[lvl] || 0), 0);

  const getNormalizedPercent = (lvl: JLPTLevel): number => {
    if (totalWeight <= 0) return lvl === selectedLevel ? 100 : 0;
    return Math.round(((weights[lvl] || 0) / totalWeight) * 100);
  };

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

  const handleToggleCustomize = () => {
    setIsCustomizing((prev) => !prev);
  };

  const handleSliderChange = (lvl: JLPTLevel, val: number) => {
    const next = { ...weights, [lvl]: val };
    const nextTotal = JLPT_LEVELS.reduce((s, l) => s + next[l], 0);
    if (nextTotal === 0) {
      next[selectedLevel] = 10;
    }
    onChangeWeights(next, false);
  };

  // Order from N1 down to N5 for clear hierarchy display
  const orderedLevels: JLPTLevel[] = ['N1', 'N2', 'N3', 'N4', 'N5'];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
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

          <button
            type="button"
            onClick={handleToggleCustomize}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isCustomizing
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            ปรับเอง
          </button>
        </div>
      </div>

      {/* Multi-segment visual percentage bar */}
      <div className="h-4 w-full rounded-full bg-slate-950 overflow-hidden flex border border-slate-800 p-0.5 gap-0.5 mb-3">
        {orderedLevels.map((lvl) => {
          const pct = getNormalizedPercent(lvl);
          if (pct <= 0) return null;
          const meta = LEVEL_METADATA[lvl];
          return (
            <div
              key={lvl}
              style={{ width: `${pct}%` }}
              className={`${meta.barColor} h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 flex items-center justify-center overflow-hidden`}
              title={`${lvl}: ${pct}%`}
            >
              {pct >= 12 && (
                <span className="text-[10px] font-extrabold text-slate-950 drop-shadow-xs">
                  {lvl} {pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Percentage chips summary */}
      <div className="grid grid-cols-5 gap-2">
        {orderedLevels.map((lvl) => {
          const pct = getNormalizedPercent(lvl);
          const meta = LEVEL_METADATA[lvl];
          const isActive = pct > 0;
          return (
            <div
              key={lvl}
              className={`rounded-xl px-2.5 py-2 border text-center transition-all ${
                isActive
                  ? `${meta.badgeClass}`
                  : 'bg-slate-950/50 border-slate-800/60 text-slate-600'
              }`}
            >
              <div className="text-xs font-bold">{lvl}</div>
              <div className="text-sm font-extrabold mt-0.5">{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Optional Custom Sliders */}
      {isCustomizing && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              ปรับสัดส่วนแต่ละระดับ
            </span>
            <button
              type="button"
              onClick={handleSelectSmartMix}
              className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {orderedLevels.map((lvl) => {
              const pct = getNormalizedPercent(lvl);
              const meta = LEVEL_METADATA[lvl];
              return (
                <div
                  key={lvl}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${meta.colorClass}`}>{lvl}</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {pct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weights[lvl] || 0}
                    onChange={(e) => handleSliderChange(lvl, Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
