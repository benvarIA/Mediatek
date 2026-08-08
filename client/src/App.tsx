import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Chassis from './components/Chassis';
import { AuthProvider } from './lastfm/AuthContext';
import { PlatineProvider } from './platine/PlatineContext';
import LibraryPage from './pages/LibraryPage';
import AddPage from './pages/AddPage';
import ItemDetailPage from './pages/ItemDetailPage';
import SurprisePage from './pages/SurprisePage';
import EntretienPage from './pages/EntretienPage';
import CallbackPage from './pages/CallbackPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider n'enveloppe rien d'autre qu'un état : il ne redirige
          jamais. On consulte la collection sans compte Last.fm. */}
      <AuthProvider>
        <PlatineProvider>
          <Chassis>
            <Routes>
              <Route path="/" element={<LibraryPage />} />
              <Route path="/add" element={<AddPage />} />
              <Route path="/item/:id" element={<ItemDetailPage />} />
              <Route path="/surprise" element={<SurprisePage />} />
              <Route path="/entretien" element={<EntretienPage />} />
              <Route path="/callback" element={<CallbackPage />} />
              {/* Sur téléphone, la platine a sa page ; ailleurs le châssis la
                  montre déjà et cette route affiche simplement les rayons. */}
              <Route path="/platine" element={<LibraryPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Chassis>
        </PlatineProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
