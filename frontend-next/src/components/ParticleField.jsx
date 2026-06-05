import { useEffect, useRef } from 'react';
import { createParticleField } from '../lib/particles.js';

// Full-screen canvas behind the chat that runs the active character's ambient
// particle effect. Restarts whenever the effect or intensity changes.
export default function ParticleField({ effect, intensity }) {
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const field = createParticleField(canvasRef.current);
    fieldRef.current = field;
    return () => { field.destroy(); fieldRef.current = null; };
  }, []);

  useEffect(() => {
    if (fieldRef.current) fieldRef.current.start(effect || 'none', intensity);
  }, [effect, intensity]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />;
}
