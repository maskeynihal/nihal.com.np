import { createContext, useContext } from 'react';
import type { LineArt } from './line-art';

/** True while the desk is on screen (within a viewport) and the tab is visible. */
export const ActiveContext = createContext(true);
export const useActive = (): boolean => useContext(ActiveContext);

export const LineArtContext = createContext<LineArt | null>(null);
export function useLineArt(): LineArt {
  const art = useContext(LineArtContext);
  if (!art) throw new Error('LineArtContext missing');
  return art;
}
