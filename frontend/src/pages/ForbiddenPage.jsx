import { useNavigate } from 'react-router-dom';
export default function ForbiddenPage() { const navigate = useNavigate(); return <main className="consumer-page"><div className="consumer-page-inner"><p className="eyebrow">403</p><h1>沒有權限查看這個頁面</h1><p>請使用有授權的角色登入，或回到前台。</p><button className="season-price-cta" onClick={() => navigate('/')}>回到首頁</button></div></main>; }
