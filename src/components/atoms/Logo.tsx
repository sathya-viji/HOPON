import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

const CORAL = '#f0492d';
const VIEWBOX_W = 420.17;
const VIEWBOX_H = 98.11;

interface LogoProps {
  height?: number;
}

export function Logo({ height = 28 }: LogoProps) {
  const { mode } = useTheme();
  const textFill = mode === 'dark' ? '#ffffff' : '#231f20';
  const width = (height / VIEWBOX_H) * VIEWBOX_W;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      accessibilityLabel="HopOn"
      accessibilityRole="image"
    >
      {/* N */}
      <Path
        fill={textFill}
        d="M364.12.84l29.64,54.74V.84h26.4v97.26h-30.89l-29.64-54.73v54.73h-26.4V.84h30.89Z"
      />
      {/* O (coral) */}
      <Path
        fill={CORAL}
        d="M340.57,16.69c32.45,47.18-61.77,112.18-94.34,65.08-32.45-47.18,61.77-112.18,94.34-65.08ZM320.69,30.41c-14.46-21.21-69.26,16.61-54.57,37.64,14.46,21.21,69.26-16.61,54.57-37.64Z"
      />
      {/* H O P */}
      <Path
        fill={textFill}
        d="M219.47.62h-44.29v8.43c-22.52-19.55-61.57-4.84-81.71,19.67V.62h-28.69v35.81H28.69V.62H0v97.26h28.69v-37.58h36.08v37.58h28.69v-9.51c22.33,19.91,61.36,5.47,81.71-18.91v28.42h28.69v-24.15h15.6c23.87,0,42.59-10.58,42.59-36.56S243.34.62,219.47.62ZM107.22,67.7c-14.69-21.04,40.11-58.85,54.57-37.64,14.69,21.04-40.11,58.85-54.57,37.64ZM219.47,49.79h-15.6v-25.23h15.6c8.34,0,13.63,3.93,13.63,12.62s-5.29,12.62-13.63,12.62Z"
      />
    </Svg>
  );
}
