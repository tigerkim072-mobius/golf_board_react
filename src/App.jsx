import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebase';
import './App.css';

const courts = ['강동휴', '1구장'];

function getAuthErrorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-email':
      return '이메일 주소를 확인해 주세요.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해 주세요.';
    default:
      return `로그인 중 오류가 발생했습니다. (${error.code || 'unknown'})`;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [court, setCourt] = useState(courts[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return undefined;

    return onAuthStateChanged(
      auth,
      (nextUser) => setUser(nextUser),
      (error) => {
        console.error('Firebase 인증 상태를 확인하지 못했습니다.', error);
        setErrorMessage(getAuthErrorMessage(error));
      },
    );
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    if (!auth) {
      setErrorMessage(
        'Firebase 설정이 없습니다. .env 파일에 Firebase 환경변수를 입력해 주세요.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error('Firebase 로그인에 실패했습니다.', error);
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;

    setErrorMessage('');
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃에 실패했습니다.', error);
      setErrorMessage(`로그아웃 중 오류가 발생했습니다. (${error.code || 'unknown'})`);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        {errorMessage && (
          <div className="error-message" role="alert">
            {errorMessage}
          </div>
        )}

        {user ? (
          <div className="signed-in">
            <h1 id="login-title">로그인 완료</h1>
            <p className="signed-in-court">{court}에 로그인했습니다.</p>
            <p className="signed-in-email">{user.email}</p>
            <button className="login-button" type="button" onClick={handleSignOut}>
              로그아웃
            </button>
          </div>
        ) : (
          <>
            <h1 id="login-title">구장 로그인</h1>
            <form onSubmit={handleSubmit}>
              <label className="form-field">
                <span>구장</span>
                <select
                  value={court}
                  onChange={(event) => setCourt(event.target.value)}
                >
                  {courts.map((courtName) => (
                    <option key={courtName} value={courtName}>
                      {courtName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>이메일</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Firebase 계정 이메일"
                  required
                />
              </label>

              <label className="form-field">
                <span>비밀번호</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </label>

              <button
                className="login-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? '로그인 중...' : '입장'}
              </button>
            </form>
            <p className="login-help">
              Firebase Authentication 이메일/비밀번호 계정으로 로그인합니다.
              구장 선택은 화면 표시용이며 실제 데이터 접근 권한은 Firebase 보안 규칙에서
              설정해야 합니다.
            </p>
          </>
        )}
      </section>

      {!user && <h2 className="court-prompt">구장을 선택하세요</h2>}
    </main>
  );
}

export default App;
