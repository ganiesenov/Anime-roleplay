import { useEffect, useState } from 'react';
import { getAllPersonas, getAllCharacters } from '../lib/db.js';

// Loads the user's personas and the full character library (both keyed by id)
// from AriaBD once on mount — used for persona selection and group casting.
export default function useLibrary() {
  const [personas, setPersonas] = useState({});
  const [charsById, setCharsById] = useState({});

  useEffect(() => {
    getAllPersonas().then((ps) => {
      const map = {};
      ps.forEach((p) => { if (p && p.id) map[p.id] = p; });
      setPersonas(map);
    });
    getAllCharacters().then((list) => {
      const map = {};
      list.forEach((c) => { if (c && c.id) map[c.id] = c; });
      setCharsById(map);
    });
  }, []);

  return { personas, setPersonas, charsById, setCharsById };
}
