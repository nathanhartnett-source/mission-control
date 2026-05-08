"use client";

import { useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";

/**
 * FitnessGamification — provides two functions:
 *   - triggerItemBurst(el): mini confetti burst near a checkbox element
 *   - triggerFireworks(): full-screen fireworks for all-items-complete
 */

export function useFitnessGamification() {
  const fireworksIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (fireworksIntervalRef.current) {
        clearInterval(fireworksIntervalRef.current);
      }
    };
  }, []);

  /**
   * Small burst at the checkbox location when a single item is ticked.
   * `el` is the button element that was clicked.
   */
  const triggerItemBurst = useCallback((el: HTMLElement | null) => {
    if (!el) {
      // Fallback: burst from center
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { x: 0.5, y: 0.5 },
        startVelocity: 20,
        ticks: 40,
        scalar: 0.8,
        colors: ["#10b981", "#34d399", "#6ee7b7", "#fff", "#fbbf24"],
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 25,
      spread: 50,
      origin: { x, y },
      startVelocity: 18,
      ticks: 35,
      scalar: 0.75,
      colors: ["#10b981", "#34d399", "#6ee7b7", "#fff", "#fbbf24"],
      disableForReducedMotion: true,
    });
  }, []);

  /**
   * Full-screen fireworks for ~3.5 seconds when all items are done.
   */
  const triggerFireworks = useCallback(() => {
    const duration = 3500; // ms
    const end = Date.now() + duration;

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const shoot = () => {
      confetti({
        particleCount: 40,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.2, 0.6) },
        startVelocity: randomInRange(25, 45),
        colors: [
          "#ff0000", "#ff4500", "#ffa500", "#ffff00",
          "#00ff00", "#00bfff", "#8a2be2", "#ff69b4",
          "#10b981", "#fbbf24",
        ],
        ticks: 60,
        scalar: 1.1,
        disableForReducedMotion: true,
      });
    };

    // Kick off the first burst immediately
    shoot();
    shoot();

    if (fireworksIntervalRef.current) {
      clearInterval(fireworksIntervalRef.current);
    }

    fireworksIntervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        if (fireworksIntervalRef.current) {
          clearInterval(fireworksIntervalRef.current);
          fireworksIntervalRef.current = null;
        }
        return;
      }
      shoot();
    }, 250);
  }, []);

  return { triggerItemBurst, triggerFireworks };
}
