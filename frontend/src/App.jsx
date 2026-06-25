import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar       from './components/Navbar';
import Home         from './pages/Home';
import PriceSearch  from './pages/PriceSearch';
import SolarTermGuide from './pages/SolarTermGuide';
import ReportPrice  from './pages/ReportPrice';
import MyBasket     from './pages/MyBasket';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/search"     element={<PriceSearch />} />
        <Route path="/solar-term" element={<SolarTermGuide />} />
        <Route path="/report"     element={<ReportPrice />} />
        <Route path="/basket"     element={<MyBasket />} />
      </Routes>
    </BrowserRouter>
  );
}
