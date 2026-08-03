import { Home, Newspaper, Search, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [['/', Home, '首頁'], ['/recommendations', Sparkles, '推薦'], ['/search', Search, '查價'], ['/news', Newspaper, '新知']];

export default function MobileBottomNav() {
  return <nav className="mobile-bottom-nav">{items.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={20} aria-hidden="true" />{label}</NavLink>)}</nav>;
}
