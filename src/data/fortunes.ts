import source from './fortunes.txt?raw';

export interface Fortune {
  id: string;
  text: string;
}

// IDs are explicit: editing or reordering the collection never invalidates a saved draw.
export const fortunes: Fortune[] = source.trim().split('\n').map((line) => {
  const divider = line.indexOf('|');
  return { id: line.slice(0, divider), text: line.slice(divider + 1).trim() };
});
export const fortuneById = new Map(fortunes.map((fortune) => [fortune.id, fortune]));
