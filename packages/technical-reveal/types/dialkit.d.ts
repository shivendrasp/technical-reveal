import type { RefObject } from 'react';
import type { TechnicalRevealOptions } from './index';
import type { TechnicalRevealHandle } from './react';

export interface RevealControlsInit extends TechnicalRevealOptions {
  /** Images offered in the Layout › Image picker. */
  images?: { value: string; label: string }[];
}

/**
 * Registers DialKit panels (Playback, Layout, Colors, Detection, Drafting, Stroke, Timing, Reveal)
 * and returns live options to spread onto <TechnicalReveal>. Mount <DialRoot /> once to show them.
 */
export function useRevealControls(revealRef: RefObject<TechnicalRevealHandle | null>, initial?: RevealControlsInit): TechnicalRevealOptions;
