import { useEffect, useRef, useState } from 'react';
import { DialRoot } from 'dialkit';
import { TechnicalReveal } from 'technical-reveal/react';
import { useRevealControls } from 'technical-reveal/dialkit';

const IMAGES = [
  { value: '/car.png', label: 'Car' },
  { value: '/demo.png', label: 'Demo render' },
];

export default function App() {
  const ref = useRef(null);
  const [info, setInfo] = useState('');
  const [dropped, setDropped] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [ar, setAr] = useState(1.5);

  // every option as a live DialKit control — "Copy parameters" → paste into your own options
  const options = useRevealControls(ref, { src: '/car.png', images: IMAGES });

  // drag & drop any image onto the page; space = play/pause, R = replay
  useEffect(() => {
    const over = (e) => { e.preventDefault(); setDragging(true); };
    const leave = (e) => { if (!e.relatedTarget) setDragging(false); };
    const drop = (e) => {
      e.preventDefault();
      setDragging(false);
      const f = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!f) return;
      const r = new FileReader();
      r.onload = () => setDropped(r.result);
      r.readAsDataURL(f);
    };
    const key = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); ref.current?.toggle(); }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) ref.current?.replay();
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => setDropped(null), [options.src]);

  return (
    <>
      <div className="page">
        <div className="frame" style={{ '--ar': ar }}>
          <TechnicalReveal
            ref={ref}
            {...options}
            src={dropped || options.src}
            alt="Technical drawing reveal"
            onAspect={setAr}
            onReady={(s) => setInfo(`${s.chains} contours · ${s.arcs} arcs · ${s.ms}ms`)}
            onError={(e) => setInfo(e.message)}
          />
        </div>
      </div>
      <div className={`status ${info ? 'show' : ''}`}>{info}</div>
      {dragging && <div className="drop">Drop an image to draft it</div>}
      <DialRoot position="top-right" theme="dark" productionEnabled />
    </>
  );
}
