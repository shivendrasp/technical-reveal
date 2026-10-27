// React entry: <TechnicalReveal src="…" {...options} ref={controllerRef} />
'use client';
import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createTechnicalReveal } from './create.js';

const CALLBACKS = ['onReady', 'onComplete', 'onError', 'onAspect'];

export const TechnicalReveal = forwardRef(function TechnicalReveal(props, ref) {
  const { className, style, ...options } = props;
  const canvasRef = useRef(null);
  const ctl = useRef(null);
  const latest = useRef(props);
  latest.current = props;

  // stable callback wrappers so changing handlers never re-creates the effect
  const withCallbacks = (o) => {
    const out = { ...o };
    for (const k of CALLBACKS) out[k] = (...a) => latest.current[k]?.(...a);
    return out;
  };

  useEffect(() => {
    ctl.current = createTechnicalReveal(canvasRef.current, { ...withCallbacks(latest.current), autoSize: true });
    return () => { ctl.current?.destroy(); ctl.current = null; };
  }, []);

  // functions are stripped by JSON, so only real option changes trigger an update
  const key = JSON.stringify(options);
  useEffect(() => {
    ctl.current?.setOptions({ ...withCallbacks(latest.current), autoSize: true });
  }, [key]);

  useImperativeHandle(ref, () => ({
    play: () => ctl.current?.play(),
    pause: () => ctl.current?.pause(),
    toggle: () => ctl.current?.toggle(),
    replay: () => ctl.current?.replay(),
    seek: (p) => ctl.current?.seek(p),
    record: () => ctl.current?.record(),
    stopRecording: () => ctl.current?.stopRecording(),
    exportPNG: () => ctl.current?.exportPNG(),
    get progress() { return ctl.current?.progress ?? 0; },
    get playing() { return ctl.current?.playing ?? false; },
    get canvas() { return canvasRef.current; },
  }), []);

  return createElement('canvas', {
    ref: canvasRef,
    className,
    style: { display: 'block', width: '100%', height: 'auto', ...style },
  });
});
