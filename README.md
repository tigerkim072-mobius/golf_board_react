# 구장 로그인

Vite와 React로 만든 구장 로그인 화면입니다. Firebase Authentication의 이메일/비밀번호 로그인을 사용합니다.

## 실행

1. Firebase 콘솔에서 웹 앱을 등록하고 Authentication의 이메일/비밀번호 제공업체를 활성화합니다.
2. 프로젝트 루트의 `.env.example`을 `.env.local`로 복사한 다음 Firebase 웹 앱 설정값을 입력합니다.

   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   ```

3. Firebase Authentication에서 로그인 계정을 만든 뒤 개발 서버를 실행합니다.

   ```sh
   npm install
   npm run dev
   ```

구장 선택 항목은 현재 화면 표시용이며 Firebase 계정 권한과 연결되어 있지 않습니다. 구장별 데이터 접근 제한은 반드시 Firestore 보안 규칙과 신뢰할 수 있는 서버 측 권한 검사로 설정해야 합니다.
