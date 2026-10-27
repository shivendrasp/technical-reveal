import type { ForwardRefExoticComponent, RefAttributes, CSSProperties } from 'react';
import type { TechnicalRevealOptions } from './index';

export interface TechnicalRevealHandle {
  readonly canvas: HTMLCanvasElement | null;
  readonly progress: number;
  readonly playing: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  replay(): void;
  seek(progress: number): void;
  record(): void;
  stopRecording(): void;
  exportPNG(): void;
}

export interface TechnicalRevealProps extends TechnicalRevealOptions {
  className?: string;
  style?: CSSProperties;
}

/** Canvas that plays the reveal. Width follows CSS (default 100%), height follows the image's aspect ratio. */
export declare const TechnicalReveal: ForwardRefExoticComponent<TechnicalRevealProps & RefAttributes<TechnicalRevealHandle>>;
