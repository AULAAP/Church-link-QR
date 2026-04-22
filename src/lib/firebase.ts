import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  query, 
  where,
  onSnapshot,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { Church, FirestoreErrorInfo } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || 'Unknown Firestore error',
    operationType: operation,
    path,
    authInfo: {
      userId: user?.uid || 'unauthenticated',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  throw new Error(JSON.stringify(errorInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection successful');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Church Services
const CHURCHES_COLLECTION = 'churches';

export async function getChurches(): Promise<Church[]> {
  try {
    const q = query(collection(db, CHURCHES_COLLECTION), orderBy('id', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Church);
  } catch (error) {
    return handleFirestoreError(error, 'list', CHURCHES_COLLECTION);
  }
}

export function subscribeToChurches(callback: (churches: Church[]) => void) {
  const q = query(collection(db, CHURCHES_COLLECTION), orderBy('id', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const churches = snapshot.docs.map(doc => doc.data() as Church);
    callback(churches);
  }, (error) => {
    console.error('Error subscribing to churches:', error);
  });
}

export async function markAsDelivered(churchId: string): Promise<void> {
  try {
    const churchDoc = doc(db, CHURCHES_COLLECTION, churchId);
    const snapshot = await getDoc(churchDoc);
    
    if (!snapshot.exists()) {
      throw new Error(`Church with ID ${churchId} not found.`);
    }
    
    const churchData = snapshot.data() as Church;
    if (churchData.status === 'Entregado') {
      throw new Error('Ya ha sido entregado');
    }

    const now = new Date();
    const deliveryDate = now.toISOString().split('T')[0];
    const deliveryTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    await updateDoc(churchDoc, {
      status: 'Entregado',
      deliveryDate,
      deliveryTime,
      deliveredAt: now.toISOString()
    });
  } catch (error: any) {
    if (error.message === 'Ya ha sido entregado') throw error;
    return handleFirestoreError(error, 'update', `${CHURCHES_COLLECTION}/${churchId}`);
  }
}

export async function updateChurchQrUrl(churchId: string, qrCodeUrl: string): Promise<void> {
  try {
    const churchDoc = doc(db, CHURCHES_COLLECTION, churchId);
    await updateDoc(churchDoc, { qrCodeUrl });
  } catch (error: any) {
    return handleFirestoreError(error, 'update', `${CHURCHES_COLLECTION}/${churchId}`);
  }
}
export async function clearAllChurches() {
  console.log('--- EXTREME CLEAN STARTED ---');
  try {
    const churchesRef = collection(db, CHURCHES_COLLECTION);
    const snapshot = await getDocs(churchesRef);
    
    if (snapshot.empty) {
      console.log('No documents found');
      return;
    }

    console.log(`Deleting ${snapshot.size} documents...`);

    // Individual delete as fallback if batch fails
    const promises = snapshot.docs.map(docSnap => {
      const docRef = doc(db, CHURCHES_COLLECTION, docSnap.id);
      return deleteDoc(docRef);
    });

    await Promise.all(promises);
    console.log('All documents deleted individually');
  } catch (error: any) {
    console.error('CRITICAL CLEANUP ERROR:', error);
    throw error;
  }
}

export async function seedChurches(churches: Church[]) {
  try {
    const batch = writeBatch(db);
    churches.forEach((church) => {
      const churchRef = doc(db, CHURCHES_COLLECTION, church.id);
      batch.set(churchRef, church);
    });
    await batch.commit();
    console.log('Seeding complete');
  } catch (error) {
    return handleFirestoreError(error, 'write', CHURCHES_COLLECTION);
  }
}
