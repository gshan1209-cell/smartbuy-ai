import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar       from './components/Navbar';
import Home         from './pages/Home';
import PriceSearch  from './pages/PriceSearch';
import MyBasket     from './pages/MyBasket';
import AgriNews     from './pages/AgriNews';
import MutualAid    from './pages/MutualAid';
import Settings     from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/search"     element={<PriceSearch />} />
        <Route path="/basket"     element={<MyBasket />} />
        <Route path="/news"       element={<AgriNews />} />
        <Route path="/mutual-aid" element={<MutualAid />} />
        <Route path="/settings"   element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
