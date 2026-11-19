// Las rutas se declaran en un solo lugar para que Metro pueda resolver las
// imagenes locales con require().
export const posters = {
  lima: require('../../assets/posters/poster-lima.png'),
  liga: require('../../assets/posters/poster-liga.png'),
  festival: require('../../assets/posters/poster-festival.png'),
  music: require('../../assets/posters/music-fest.png'),
} as const;

export function posterFor(evento: string, codigo: string) {
  const key = `${evento} ${codigo}`.toLowerCase();
  if (key.includes('liga') || key.includes('futbol') || key.includes('fútbol')) return posters.liga;
  if (key.includes('festival') || key.includes('indie')) return posters.festival;
  if (key.includes('music') || key.includes('lima')) return posters.lima;
  return posters.music;
}
