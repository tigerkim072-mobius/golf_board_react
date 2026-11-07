import { createContext } from 'react';
import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from '../firebase/firebase';

export const GolfContext = createContext(null);
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
