import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { FeedbackWidget } from './components/FeedbackWidget';
import LibraryPage from './pages/LibraryPage';
import AddPage from './pages/AddPage';
import ItemDetailPage from './pages/ItemDetailPage';
import SurprisePage from './pages/SurprisePage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/surprise" element={<SurprisePage />} />
        </Routes>
      </Layout>
      <FeedbackWidget
        apiKey={import.meta.env.VITE_AMELIORATOR_API_KEY}
        amelioratorUrl={import.meta.env.VITE_AMELIORATOR_URL}
      />
    </BrowserRouter>
  );
}
