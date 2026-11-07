import { useEffect, useState } from 'react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db, GolfContext } from './GolfContext';

function getFirestoreErrorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Firestore 접근 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.';
  }
  if (error.code === 'unavailable') {
    return 'Firestore에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
  }
  return `Firestore 처리 중 오류가 발생했습니다. (${error.code || 'unknown'})`;
}

function GolfProvider({ children }) {
  const [courts, setCourts] = useState([]);
  const [errorMessage, setErrorMessage] = useState();
  const [isLoadingCourts, setIsLoadingCourts] = useState(true);

  async function createCourt(name, password) {
    if (!db) {
      throw new Error('Firebase 설정이 없어 구장을 생성할 수 없습니다.');
    }

    const trimmedName = name.trim();
    if (!trimmedName || !password) {
      throw new Error('구장 이름과 비밀번호를 입력해 주세요.');
    }

    const courtReference = await addDoc(collection(db, 'courts'), {
      이름: trimmedName,
      암호: password,
    });
    const newCourt = { id: courtReference.id, name: trimmedName };
    setCourts((currentCourts) =>
      [...currentCourts, newCourt].sort((first, second) =>
        first.name.localeCompare(second.name, 'ko'),
      ),
    );
    setErrorMessage(undefined);
    return newCourt;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCourts() {
      if (!db) {
        setErrorMessage(
          'Firebase 설정이 없습니다. 프로젝트 루트의 .env.local에 Firebase 설정을 입력해 주세요.',
        );
        setIsLoadingCourts(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'courts'));
        const courtList = snapshot.docs
          .map((courtDocument) => {
            const data = courtDocument.data();
            return {
              id: courtDocument.id,
              name: String(data['이름'] || data.name || courtDocument.id),
            };
          })
          .sort((first, second) => first.name.localeCompare(second.name, 'ko'));

        if (isMounted) {
          setCourts(courtList);
          if (courtList.length === 0) {
            setErrorMessage(
              'Firestore courts 컬렉션에 등록된 구장이 없습니다.',
            );
          }
        }
      } catch (error) {
        console.error('Firestore 구장 목록을 불러오지 못했습니다.', error);
        if (isMounted) setErrorMessage(getFirestoreErrorMessage(error));
      } finally {
        if (isMounted) setIsLoadingCourts(false);
      }
    }

    loadCourts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <GolfContext.Provider
      value={{ courts, isLoadingCourts, errorMessage, createCourt }}
    >
      {children}
    </GolfContext.Provider>
  );
}
export default GolfProvider;
