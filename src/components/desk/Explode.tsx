import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getMotion } from '../../lib/prefs';
import { explodeTarget } from '../../lib/desk/explode';
import { ExplodeView } from './explode-view';
import { useLineArt } from './scene-context';
import { physicsBridge } from './physics-bridge';
import { setExplodeProbe } from './scene-hooks';

/**
 * Scroll-linked exploded view (design 4.4). One passive scroll listener writes the target
 * (scroll over the hero's height); each drawn frame lerps toward it and invalidates until it
 * converges, then rendering stops. The drawing is off under reduced motion (the Scene is not
 * mounted then; this also ignores scroll if motion is switched off while live).
 */
export function Explode() {
  const { scene, invalidate } = useThree();
  const art = useLineArt();
  const view = useRef<ExplodeView | null>(null);

  useEffect(() => {
    const v = new ExplodeView(scene, art);
    view.current = v;
    const hero = document.getElementById('desk');
    let range = 1;
    const measure = () => {
      range = hero?.offsetHeight || window.innerHeight;
    };
    const onScroll = () => {
      const t =
        getMotion() === 'full' ? explodeTarget(window.scrollY, range) : 0;
      if (t === v.target) return;
      v.setTarget(t);
      invalidate();
    };
    measure();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const ro =
      hero && typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            measure();
            onScroll();
          })
        : null;
    if (hero) ro?.observe(hero);
    setExplodeProbe({
      state: () => ({ target: v.target, factor: v.factor, range }),
      offset: (id) => v.offsetOf(id),
      leaders: () => v.leaderState(),
    });
    invalidate();
    return () => {
      window.removeEventListener('scroll', onScroll);
      ro?.disconnect();
      setExplodeProbe(null);
      view.current = null;
      v.dispose();
    };
  }, [scene, art, invalidate]);

  useFrame((state) => {
    const awake = (id: string) => physicsBridge.api()?.awake(id) ?? false;
    if (view.current?.update(awake, state.size)) invalidate();
  });
  return null;
}
