import { useState, useEffect, useCallback, useMemo } from 'react';
import Masonry from './Masonry';

const lbStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 500,
    background: 'rgba(10, 8, 6, 0.96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  close: {
    position: 'fixed',
    top: '1.5rem',
    right: '1.5rem',
    background: 'none',
    border: '1px solid rgba(240,230,206,0.2)',
    color: '#f0e6ce',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.85rem',
    width: '2.4rem',
    height: '2.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBase: {
    position: 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: '1px solid rgba(240,230,206,0.15)',
    color: '#f0e6ce',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '1.2rem',
    width: '3rem',
    height: '3rem',
    cursor: 'pointer',
  },
  counter: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.65rem',
    letterSpacing: '0.15em',
    color: 'rgba(240,230,206,0.4)',
  },
};

export default function MasonryCollage({ photos }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const items = useMemo(() => photos.map(p => ({
    id: p.id,
    img: p.img,
    url: '#',
    height: p.height,
  })), [photos]);

  useEffect(() => {
    return () => { document.body.style.overflow = ''; };
  }, []);

  const open = useCallback(index => {
    setLightboxIndex(index);
    document.body.style.overflow = 'hidden';
  }, []);

  const close = useCallback(() => {
    setLightboxIndex(null);
    document.body.style.overflow = '';
  }, []);

  const prev = useCallback(() => {
    setLightboxIndex(i => (i - 1 + items.length) % items.length);
  }, [items.length]);

  const next = useCallback(() => {
    setLightboxIndex(i => (i + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = e => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightboxIndex, close, prev, next]);

  const handleGridClick = e => {
    const wrapper = e.target.closest('[data-key]');
    if (!wrapper) return;
    e.stopPropagation();
    const key = wrapper.dataset.key;
    const index = items.findIndex(item => item.id === key);
    if (index !== -1) open(index);
  };

  const isOpen = lightboxIndex !== null;

  return (
    <>
      <div
        onClickCapture={handleGridClick}
        style={{ width: '100%', minHeight: '100vh' }}
      >
        <Masonry
          items={items}
          ease="power1.out"
          duration={0.4}
          stagger={0.13}
          animateFrom="bottom"
          scaleOnHover={true}
          hoverScale={0.95}
          blurToFocus={true}
          colorShiftOnHover={false}
        />
      </div>

      {isOpen && (
        <div
          style={lbStyles.overlay}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal="true"
        >
          <button style={lbStyles.close} onClick={close} aria-label="Schließen">✕</button>
          <button
            style={{ ...lbStyles.navBase, left: '1.5rem' }}
            onClick={prev}
            aria-label="Zurück"
          >←</button>
          <button
            style={{ ...lbStyles.navBase, right: '1.5rem' }}
            onClick={next}
            aria-label="Weiter"
          >→</button>
          <img
            style={lbStyles.img}
            src={items[lightboxIndex].img}
            alt={`Foto ${lightboxIndex + 1}`}
          />
          <p style={lbStyles.counter}>{lightboxIndex + 1} / {items.length}</p>
        </div>
      )}
    </>
  );
}
