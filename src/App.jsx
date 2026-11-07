import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScoreBoard from './components/ScoreBoard';
import Players from './components/Players';
import Login from './components/Login';
import Games from './components/Games';
import Admin from './components/Admin';
import GolfProvider from './context/GolfProvider';

function App() {
  return (
    <>
      <GolfProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/games" element={<Games />} />
            <Route path="/scores" element={<ScoreBoard />} />
            <Route path="/players" element={<Players />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </BrowserRouter>
      </GolfProvider>
    </>
  );
}

export default App;
