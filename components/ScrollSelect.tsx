"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Option {
  value: string;
  label: string;
}

interface ScrollSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  width?: string;
  horizontal?: boolean;
  orientation?: "left" | "right";
}

const ScrollSelect: React.FC<ScrollSelectProps> = ({
  options,
  value,
  onChange,
  label,
  width = "w-64",
  horizontal = false,
  orientation = "left",
}) => {
  const [selectedIndex, setSelectedIndex] = useState(
    options.findIndex((option) => option.value === value)
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const itemSize = 40;
  const visibleItems = 3;
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- port of the old picker: external value drives the index
    setSelectedIndex(options.findIndex((option) => option.value === value));
  }, [value, options]);

  useEffect(
    () => () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    },
    []
  );

  const debouncedOnChange = useCallback(
    (newIndex: number) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        onChange(options[newIndex].value);
      }, 1000);
    },
    [onChange, options]
  );

  const handleWheel = (event: React.WheelEvent) => {
    const newIndex = Math.max(
      0,
      Math.min(selectedIndex + Math.sign(event.deltaY), options.length - 1)
    );
    setSelectedIndex(newIndex);
    debouncedOnChange(newIndex);
  };

  const handleClick = (index: number) => {
    setSelectedIndex(index);
    onChange(options[index].value);
  };

  const getVisibleOptions = () => {
    let start = Math.max(0, selectedIndex - 1);
    const end = Math.min(options.length, start + visibleItems);

    // Adjust start if we're at the end of the list
    if (end - start < visibleItems) {
      start = Math.max(0, end - visibleItems);
    }

    return options.slice(start, end);
  };

  const getItemStyle = (index: number) => {
    const distance = index - selectedIndex;
    return {
      opacity: 1 - Math.min(Math.abs(distance) * 0.25, 0.6),
      scale: 1 - Math.min(Math.abs(distance) * 0.15, 0.3),
      zIndex: visibleItems - Math.abs(distance),
    };
  };

  return (
    <div
      className={`relative ${width} ${
        horizontal ? "h-20" : "h-32"
      } overflow-hidden scroll-select-container`}
      ref={containerRef}
      role="group"
      aria-label={label}
    >
      <div
        className={`absolute inset-0 flex ${
          horizontal ? "flex-row" : "flex-col"
        } items-center py-2 overflow-hidden`}
        onWheel={handleWheel}
      >
        <AnimatePresence initial={false}>
          {getVisibleOptions().map((option, index) => {
            const actualIndex = options.indexOf(option);
            let offset = (index - 1) * itemSize;

            // Adjust for top and bottom edges
            if (selectedIndex === 0) {
              offset = index * itemSize;
            } else if (selectedIndex === options.length - 1) {
              offset = (index - 2) * itemSize;
            }

            return (
              <motion.div
                key={option.value}
                initial={{ opacity: 0, [horizontal ? "x" : "y"]: offset }}
                animate={{
                  opacity: getItemStyle(actualIndex).opacity,
                  [horizontal ? "x" : "y"]: offset,
                  scale: getItemStyle(actualIndex).scale,
                  zIndex: getItemStyle(actualIndex).zIndex,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`cursor-pointer text-foreground text-center ${
                  horizontal ? "h-full" : "w-full"
                } ${
                  horizontal ? "w-40" : "h-10"
                } flex items-center absolute px-2 scroll-select-item ${
                  orientation === "right" ? "justify-start" : "justify-end"
                } ${
                  actualIndex === selectedIndex
                    ? `font-bold text-4xl ${
                        orientation === "right" ? "pl-6" : "pr-6"
                      }`
                    : "font-normal text-base "
                }`}
                style={{
                  [horizontal ? "left" : "top"]: "50%",
                  [horizontal ? "marginLeft" : "marginTop"]: -itemSize / 2,
                  transform: `
                    translate${horizontal ? "X" : "Y"}(${offset}px)
                    rotate${horizontal ? "Y" : "X"}(${
                    (actualIndex - selectedIndex) * 15
                  }deg)
                    translateZ(${Math.abs(actualIndex - selectedIndex) * -10}px)
                  `,
                }}
                onClick={() => handleClick(actualIndex)}
              >
                <span className="truncate">{option.label}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ScrollSelect;
