import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  muted?: boolean;
};

export function BrandMark({ size = 44, color = '#c6b2ff', muted = false }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id="brand" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <Stop stopColor={color} />
          <Stop offset="1" stopColor={muted ? '#4ecf94' : '#3af2d2'} />
        </LinearGradient>
      </Defs>
      <Circle cx="24" cy="24" r="22" fill="url(#brand)" opacity={0.18} />
      <Circle cx="24" cy="24" r="18" stroke="url(#brand)" strokeWidth="1.4" opacity={0.55} />
      <Path
        d="M14.5 19.2C14.5 17.985 15.485 17 16.7 17H31.3C32.515 17 33.5 17.985 33.5 19.2V22.1C32.12 22.1 31 23.22 31 24.6C31 25.98 32.12 27.1 33.5 27.1V29.8C33.5 31.015 32.515 32 31.3 32H16.7C15.485 32 14.5 31.015 14.5 29.8V26.9C15.88 26.9 17 25.78 17 24.4C17 23.02 15.88 21.9 14.5 21.9V19.2Z"
        fill="url(#brand)"
      />
      <Path d="M21 22.2L22.35 24.7L27.4 20.5" stroke="#08090d" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 34.5H28" stroke="url(#brand)" strokeWidth="2" strokeLinecap="round" opacity={0.65} />
    </Svg>
  );
}
