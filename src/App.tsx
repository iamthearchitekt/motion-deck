import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DeckLibrary from './pages/DeckLibrary';
import DeckEditor from './pages/DeckEditor';
import PublishedDeckView from './pages/PublishedDeckView';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedRoute><DeckLibrary /></ProtectedRoute>} />
        <Route path="/editor/:deckId" element={<ProtectedRoute><DeckEditor /></ProtectedRoute>} />
        <Route path="/deck/:slug" element={<PublishedDeckView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
