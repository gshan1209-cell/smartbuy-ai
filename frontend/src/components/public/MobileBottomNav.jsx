import { Bell, Home, Search, ShoppingBasket, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [['/', Home, '首頁'], ['/search', Search, '查菜價'], ['/basket', ShoppingBasket, '菜籃'], ['/alerts', Bell, '提醒'], ['/settings', UserRound, '我的']];

export default function MobileBottomNav() {
  return <nav className="mobile-bottom-nav">{items.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={20} aria-hidden="true" />{label}</NavLink>)}</nav>;
}
