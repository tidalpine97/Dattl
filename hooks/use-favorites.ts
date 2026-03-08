import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persists a list of favorited item names across sessions.
 *
 * storageKey       — AsyncStorage key to use (pass different keys per tab).
 * favorites        — ordered list of favorited names (most-recently-starred last).
 * toggleFavorite   — adds or removes a name, case-insensitive.
 */
export function useFavorites(storageKey: string): {
  favorites: string[];
  toggleFavorite: (name: string) => void;
} {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load once on mount.
  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then(raw => { if (raw) setFavorites(JSON.parse(raw)); })
      .catch(e => console.error('Failed to load favorites:', e));
  }, [storageKey]);

  // Saves inline inside the setter so we don't need a loaded-guard effect.
  const toggleFavorite = useCallback((name: string) => {
    setFavorites(prev => {
      const key = name.toLowerCase();
      const already = prev.some(f => f.toLowerCase() === key);
      const next = already
        ? prev.filter(f => f.toLowerCase() !== key)
        : [...prev, name];
      AsyncStorage.setItem(storageKey, JSON.stringify(next))
        .catch(e => console.error('Failed to save favorites:', e));
      return next;
    });
  }, [storageKey]);

  return { favorites, toggleFavorite };
}
