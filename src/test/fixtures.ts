import type { Word } from '../lib/captions/types';

/** Builds words from "text@start-end" tokens, e.g. "Hola@0-0.4". Plain tokens get evenly spaced. */
export function words(spec: string, step = 0.35): Word[] {
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((token, i) => {
      const match = /^(.+)@([\d.]+)-([\d.]+)$/.exec(token);
      if (match)
        return {
          id: `w${i + 1}`,
          text: match[1] ?? '',
          start: Number(match[2]),
          end: Number(match[3]),
        };
      return {
        id: `w${i + 1}`,
        text: token,
        start: round(i * step),
        end: round(i * step + step * 0.85),
      };
    });
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export const SPANISH_SPEECH = words(
  'Hola a todos, bienvenidos a Letritas. Hoy les muestro cómo crear subtítulos animados en segundos. ¡Y todo funciona en tu navegador, sin subir nada a ningún servidor!',
);
