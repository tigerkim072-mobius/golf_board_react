import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  FiArrowRight,
  FiCheck,
  FiFlag,
  FiLock,
  FiMapPin,
  FiPlus,
  FiShield,
  FiX,
} from 'react-icons/fi';
import './Login.css';
import { db, GolfContext } from '../context/GolfContext';
const Login = () => {
  const navigate = useNavigate();
  const { courts, isLoadingCourts, errorMessage, createCourt } =
    useContext(GolfContext);

  const [selectedCourtId, setSelectedCourtId] = useState('');
  const selectedCourt = selectedCourtId || courts[0]?.id || '';
  const [courtLoadError, setCourtLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userPassword, setUserPassword] = useState('');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtPassword, setNewCourtPassword] = useState('');
  const [isCreatingCourt, setIsCreatingCourt] = useState(false);
  const [createCourtError, setCreateCourtError] = useState('');
  const [createCourtSuccess, setCreateCourtSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!db || !selectedCourt) {
      setCourtLoadError('로그인할 구장을 선택해 주세요.');
      return;
    }

    setCourtLoadError('');
    setIsSubmitting(true);
    try {
      const courtSnapshot = await getDoc(doc(db, 'courts', selectedCourt));
      if (!courtSnapshot.exists()) {
        setCourtLoadError('선택한 구장 정보를 찾을 수 없습니다.');
        return;
      }

      const storedPassword = courtSnapshot.data()['암호'];
      if (
        typeof storedPassword !== 'string' ||
        storedPassword !== userPassword
      ) {
        setCourtLoadError('비밀번호가 올바르지 않습니다.');
        return;
      }

      navigate('/games', { state: { courtId: selectedCourt } });
    } catch (error) {
      console.error('구장 로그인에 실패했습니다.', error);
      setCourtLoadError(
        '로그인 중 오류가 발생했습니다. 네트워크와 Firestore 권한을 확인해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handlePasswordChange = (event) => {
    setUserPassword(event.target.value);
    setCourtLoadError('');
  };

  const handleCreateCourt = async (event) => {
    event.preventDefault();
    const trimmedName = newCourtName.trim();
    if (!trimmedName || !newCourtPassword) {
      setCreateCourtError('구장 이름과 비밀번호를 입력해 주세요.');
      setCreateCourtSuccess('');
      return;
    }

    setIsCreatingCourt(true);
    setCreateCourtError('');
    setCreateCourtSuccess('');
    try {
      const newCourt = await createCourt(trimmedName, newCourtPassword);
      setSelectedCourtId(newCourt.id);
      setUserPassword(newCourtPassword);
      setCreateCourtSuccess(
        `${newCourt.name} 구장을 만들었습니다. 로그인해 주세요.`,
      );
      setNewCourtName('');
      setNewCourtPassword('');
      setIsCreateFormOpen(false);
    } catch (error) {
      console.error('구장을 생성하지 못했습니다.', error);
      setCreateCourtError(
        error?.code === 'permission-denied'
          ? '구장을 생성할 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.'
          : error?.message || '구장 생성 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCreatingCourt(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-shell">
        <section
          className="login-welcome"
          aria-labelledby="login-welcome-title"
        >
          <div className="login-brand">
            <span className="login-brand__mark">
              <FiFlag aria-hidden="true" />
            </span>
            <span>
              GREEN<span className="login-brand__accent">CARD</span>
            </span>
          </div>
          <div className="login-welcome__content">
            <span className="login-eyebrow">GOLF SCOREBOARD</span>
            <h1 id="login-welcome-title">
              오늘의 라운드를
              <br />
              <span>시작해 볼까요?</span>
            </h1>
            <p>
              구장을 선택하고 로그인하면
              <br />
              라운드 스코어보드가 준비됩니다.
            </p>
          </div>
          <div className="login-course-art" aria-hidden="true">
            <span className="login-course-art__sun" />
            <span className="login-course-art__hill login-course-art__hill--back" />
            <span className="login-course-art__hill login-course-art__hill--front" />
            <span className="login-course-art__flag">
              <FiFlag />
            </span>
            <span className="login-course-art__ball" />
          </div>
          <div className="login-welcome__footer">
            <FiShield aria-hidden="true" />
            구장별로 안전하게 관리되는 스코어
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-form-title">
          <div className="login-panel__heading">
            <span className="login-panel__icon">
              <FiLock aria-hidden="true" />
            </span>
            <span className="login-eyebrow">WELCOME BACK</span>
            <h2 id="login-form-title">로그인</h2>
            <p>라운드 정보를 확인하려면 구장에 로그인해 주세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
                <div>
                  <label htmlFor="court">구장 선택</label>
                  <select
                    id="court"
                    name="court"
                    value={selectedCourt}
                    onChange={(event) => setSelectedCourtId(event.target.value)}
                    disabled={isLoadingCourts || courts.length === 0}
                    required
                  >
                    <option value="">
                      {isLoadingCourts
                        ? '구장 목록을 불러오는 중...'
                        : '구장을 선택하세요'}
                    </option>
                    {courts.map((court) => (
                      <option key={court.id} value={court.id}>
                        {court.name}
                      </option>
                    ))}
                  </select>
                  {courts.length === 0 && !isLoadingCourts && !errorMessage && (
                    <span className="login-field-hint">
                      등록된 구장이 없습니다.
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor="password">비밀번호</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={userPassword}
                    onChange={handlePasswordChange}
                    autoComplete="current-password"
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                </div>

                {(courtLoadError || errorMessage) && (
                  <p role="alert" className="login-error">
                    {courtLoadError || errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    isLoadingCourts || isSubmitting || courts.length === 0
                  }
                  className="login-submit"
                >
                  <span>{isSubmitting ? '확인 중...' : '구장 입장하기'}</span>
                  <FiArrowRight aria-hidden="true" />
                </button>
              </form>
              <div className="login-panel__note">
                <FiMapPin aria-hidden="true" />
                구장 비밀번호 확인 후 게임방을 선택할 수 있습니다.
              </div>
              <div className="login-create">
                <button
                  className="login-create__toggle"
                  type="button"
                  aria-expanded={isCreateFormOpen}
                  aria-controls="create-court-form"
                  onClick={() => {
                    setIsCreateFormOpen((isOpen) => !isOpen);
                    setCreateCourtError('');
                    setCreateCourtSuccess('');
                  }}
                >
                  {isCreateFormOpen ? (
                    <FiX aria-hidden="true" />
                  ) : (
                    <FiPlus aria-hidden="true" />
                  )}
                  {isCreateFormOpen ? '구장 만들기 닫기' : '새 구장 만들기'}
                </button>
                {createCourtSuccess && (
                  <p className="login-create__success" role="status">
                    <FiCheck aria-hidden="true" />
                    {createCourtSuccess}
                  </p>
                )}
                {isCreateFormOpen && (
                  <form
                    id="create-court-form"
                    className="login-create__form"
                    onSubmit={handleCreateCourt}
                  >
                    <label htmlFor="new-court-name">구장 이름</label>
                    <input
                      id="new-court-name"
                      type="text"
                      value={newCourtName}
                      onChange={(event) => setNewCourtName(event.target.value)}
                      placeholder="예: 그린 스크린골프"
                      maxLength="50"
                      autoComplete="organization"
                      required
                    />
                    <label htmlFor="new-court-password">구장 비밀번호</label>
                    <input
                      id="new-court-password"
                      type="password"
                      value={newCourtPassword}
                      onChange={(event) =>
                        setNewCourtPassword(event.target.value)
                      }
                      placeholder="로그인에 사용할 비밀번호"
                      autoComplete="new-password"
                      required
                    />
                    {createCourtError && (
                      <p className="login-error" role="alert">
                        {createCourtError}
                      </p>
                    )}
                    <button
                      className="login-create__submit"
                      type="submit"
                      disabled={isCreatingCourt || isLoadingCourts}
                    >
                      {isCreatingCourt ? '구장 생성 중...' : '구장 만들기'}
                    </button>
                  </form>
                )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
