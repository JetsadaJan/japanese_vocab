import React from 'react';
import { kanaToRomaji } from '../utils/romaji';

interface JapaneseTextProps {
  expression: string;
  reading: string;
  romaji?: string;
  showHiragana: boolean;
  showRomaji?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const JapaneseText: React.FC<JapaneseTextProps> = ({
  expression,
  reading,
  romaji,
  showHiragana,
  showRomaji = false,
  size = 'md',
  className = '',
}) => {
  const hasDistinctReading = Boolean(reading && reading.trim() !== expression.trim());
  const computedRomaji = romaji || kanaToRomaji(reading || expression);

  const sizeStyles = {
    sm: {
      reading: 'text-xs text-rose-300/90 font-medium mb-0.5',
      expression: 'text-base font-bold',
      romaji: 'text-[11px] text-amber-300/90 font-mono font-semibold mt-0.5',
    },
    md: {
      reading: 'text-xs sm:text-sm text-rose-300 font-medium mb-1',
      expression: 'text-xl sm:text-2xl font-bold',
      romaji: 'text-xs sm:text-sm text-amber-300 font-mono font-semibold mt-1',
    },
    lg: {
      reading: 'text-sm sm:text-base text-rose-300 font-medium mb-1',
      expression: 'text-2xl sm:text-3xl font-extrabold',
      romaji: 'text-xs sm:text-sm text-amber-300 font-mono font-semibold mt-1',
    },
    xl: {
      reading: 'text-base sm:text-xl text-rose-300 font-semibold mb-2 tracking-wide',
      expression: 'text-4xl sm:text-6xl font-extrabold tracking-tight',
      romaji: 'text-sm sm:text-lg text-amber-300 font-mono font-semibold mt-2 tracking-wide',
    },
  }[size];

  return (
    <div className={`inline-flex flex-col items-center font-jp ${className}`}>
      {showHiragana && hasDistinctReading && (
        <span className={`${sizeStyles.reading} leading-tight select-text`}>
          {reading}
        </span>
      )}
      <span className={`${sizeStyles.expression} leading-snug select-text`}>
        {expression}
      </span>
      {showRomaji && computedRomaji && (
        <span className={`${sizeStyles.romaji} leading-tight select-text font-sans`}>
          [{computedRomaji}]
        </span>
      )}
    </div>
  );
};
