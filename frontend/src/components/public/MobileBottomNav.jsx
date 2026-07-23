import { NavLink } from 'react-router-dom';
export default function MobileBottomNav(){return <nav className="mobile-bottom-nav">{[['/','⌂','首頁'],['/search','⌕','查菜價'],['/basket','🧺','菜籃'],['/alerts','🔔','提醒'],['/settings','☺','我的']].map(([to,icon,label])=><NavLink key={to} to={to} end={to==='/' }><span>{icon}</span>{label}</NavLink>)}</nav>}
