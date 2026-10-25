/**
 * Une clases condicionales sin dependencias externas.
 * Acepta strings, arrays y objetos `{ clase: condicion }`.
 */
export const cn = (...argumentos) =>
  argumentos
    .flatMap((argumento) => {
      if (!argumento) return [];
      if (typeof argumento === 'string' || typeof argumento === 'number') return [String(argumento)];
      if (Array.isArray(argumento)) return [cn(...argumento)];
      if (typeof argumento === 'object') {
        return Object.entries(argumento)
          .filter(([, activo]) => Boolean(activo))
          .map(([clase]) => clase);
      }
      return [];
    })
    .filter(Boolean)
    .join(' ');
