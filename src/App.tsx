import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DeckLibrary from './pages/DeckLibrary';
import DeckEditor from './pages/DeckEditor';
import PublishedDeckView from './pages/PublishedDeckView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DeckLibrary />} />
        <Route path="/editor/:deckId" element={<DeckEditor />} />
        <Route path="/deck/:slug" element={<PublishedDeckView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
