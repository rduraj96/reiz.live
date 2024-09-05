import React, { useMemo } from "react";

interface AnimatedWaveformProps {
  width?: number;
  height?: number;
  color?: string;
  bars?: number;
}

const AnimatedWaveform: React.FC<AnimatedWaveformProps> = ({
  width = 18,
  height = 18,
  color = "currentColor",
  bars = 6,
}) => {
  const barWidth = 2;
  const gap = 2;
  const viewBoxWidth = bars * (barWidth + gap) - gap;

  const barConfigs = useMemo(() => {
    return [...Array(bars)].map((_, index) => {
      const minHeight = 4 + Math.floor(Math.random() * 8);
      const maxHeight = minHeight + 8 + Math.floor(Math.random() * 8);
      const animationDuration = 0.8 + Math.random() * 0.7;
      const animationDelay = Math.random() * -animationDuration;
      return { minHeight, maxHeight, animationDuration, animationDelay };
    });
  }, [bars]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${viewBoxWidth} 24`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {barConfigs.map((config, index) => {
        const x = index * (barWidth + gap);
        const { minHeight, maxHeight, animationDuration, animationDelay } =
          config;

        return (
          <rect
            key={index}
            x={x}
            y={12 - minHeight / 2}
            width={barWidth}
            height={minHeight}
            fill={color}
          >
            <animate
              attributeName="height"
              values={`${minHeight};${maxHeight};${minHeight}`}
              dur={`${animationDuration}s`}
              begin={`${animationDelay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              values={`${12 - minHeight / 2};${12 - maxHeight / 2};${
                12 - minHeight / 2
              }`}
              dur={`${animationDuration}s`}
              begin={`${animationDelay}s`}
              repeatCount="indefinite"
            />
          </rect>
        );
      })}
    </svg>
  );
};

export default AnimatedWaveform;
