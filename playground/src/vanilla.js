import { createTechnicalReveal } from 'technical-reveal';

const hero = createTechnicalReveal(document.getElementById('hero'), {
  src: '/car.png',
  alt: 'Car, drawn as a technical drawing',
  playback: { loop: false },
  onComplete: () => console.log('hero done'),
});

document.querySelector('.controls').addEventListener('click', (e) => {
  const a = e.target.dataset.a;
  if (a === 'replay') hero.replay();
  if (a === 'toggle') hero.toggle();
  if (a === 'blueprint' || a === 'ink') hero.update({ colors: { preset: a } });
});

createTechnicalReveal(document.getElementById('in-view'), {
  src: '/car.png',
  colors: { preset: 'blueprint' },
  playback: { autoplay: 'inView', loop: false },
  reveal: { keepLines: 0 },
});
