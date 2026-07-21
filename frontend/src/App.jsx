import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar         from './components/Navbar';
import Home           from './pages/Home';
import PriceSearch    from './pages/PriceSearch';
import ProductDetail  from './pages/ProductDetail';
import MyBasket       from './pages/MyBasket';
import AgriNews       from './pages/AgriNews';
import MutualAid      from './pages/MutualAid';
import Settings       from './pages/Settings';
import Login          from './pages/Login';
import Register       from './pages/Register';

export default function App() {
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('smartbuy_display_prefs') || '{}');
      document.documentElement.setAttribute('data-theme', p.theme || 'light');
    } catch {}
  }, []);

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/search"     element={<PriceSearch />} />
        <Route path="/product/:name" element={<ProductDetail />} />
        <Route path="/basket"     element={<MyBasket />} />
        <Route path="/news"       element={<AgriNews />} />
        <Route path="/mutual-aid" element={<MutualAid />} />
        <Route path="/settings"   element={<Settings />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
