import { useState } from 'react';
import { loadSavedNews, toggleSavedNews } from '../lib/savedNews';
import { loadBasket } from '../lib/basket';

// 找出文章標題/內文中提到的菜籃品項，供「與你的菜籃相關」標示使用
function matchedBasketItems(article, basket) {
  return basket.filter(name => article.title.includes(name) || article.summary.includes(name));
}

// mock 資料：農業部官網 API 目前無法直接串接（timeout），先以示範內容呈現版型，
// 待後端 proxy 完成後改為真實資料，元件介面不須更動。
const ARTICLES = [
  {
    id: 1,
    tag: '節氣',
    title: '小暑將至，葉菜類如何度過高溫期',
    date: '2026-06-28',
    source: '農業氣象週報',
    summary: '小暑後氣溫持續偏高，葉菜類生長速度加快但也容易未熟抽苔。建議加強遮蔭與灌溉頻率，並適度提前採收，避免因高溫造成品質下降與價格波動。',
  },
  {
    id: 2,
    tag: '節氣',
    title: '颱風季來臨前，農損預防措施總整理',
    date: '2026-06-20',
    source: '農業部農糧署',
    summary: '每年 6～9 月為西太平洋颱風活躍期，露天栽培作物首當其衝。提前做好排水溝清淤、支架加固與覆蓋防護，可有效降低倒伏與淹水造成的損失。',
  },
  {
    id: 3,
    tag: '農技',
    title: '甘藍輪作全攻略：如何避免地力衰退',
    date: '2026-06-15',
    source: '農業試驗所',
    summary: '甘藍連作容易導致土壤病原菌累積、地力下降。建議與豆科作物（如毛豆、菜豆）輪作，並在休耕期間種植綠肥作物翻耕，維持土壤有機質含量。',
  },
  {
    id: 4,
    tag: '農技',
    title: '有機質肥料施用時機與比例建議',
    date: '2026-06-10',
    source: '農業改良場',
    summary: '有機質肥料分解速度較慢，建議於整地前 2～3 週施用，讓養分有充分時間釋放。搭配土壤檢測結果調整用量，避免過量施用造成肥傷或地下水污染。',
  },
  {
    id: 5,
    tag: '市場',
    title: '本季蔬果外銷動態：東南亞市場需求上升',
    date: '2026-06-25',
    source: '農業貿易情報',
    summary: '受當地氣候異常影響，東南亞多國葉菜供應吃緊，帶動我國蔬果外銷詢價增加。業者可留意出口檢疫規範，掌握短期外銷契機。',
  },
  {
    id: 6,
    tag: '市場',
    title: '批發市場拍賣制度小知識：如何看懂上中下價',
    date: '2026-06-05',
    source: '農業部農糧署',
    summary: '批發市場公布的「上價／中價／下價」分別代表當日成交價格區間的高、中、低三個代表值。掌握三者落差，能更準確判斷市況是否穩定或波動劇烈。',
  },
];

const TAGS = ['全部', '節氣', '農技', '市場'];
const TAG_BADGE = { '節氣': 'yz-bdg-g', '農技': 'yz-bdg-b', '市場': 'yz-bdg-o' };

export default function AgriNews() {
  const [activeTag, setActiveTag] = useState('全部');
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState(() => loadSavedNews().map(a => a.id));
  const [basket] = useState(loadBasket);

  function handleToggleSave(e, article) {
    e.stopPropagation();
    const next = toggleSavedNews(article);
    setSavedIds(next.map(a => a.id));
  }

  const q = query.trim();
  const visible = ARTICLES
    .filter(a => activeTag === '全部' || a.tag === activeTag)
    .filter(a => !q || a.title.includes(q) || a.summary.includes(q));

  return (
    <div className="yz-page" style={{ padding: '32px 40px 60px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📰 農產新知</h1>
        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 4 }}>
          彙整節氣提醒、栽培技術與市場動態，協助掌握產銷節奏。
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--yz-dim)', marginBottom: 20 }}>
          目前為示範內容，農業部資料源串接中
        </p>

        <input
          className="yz-input"
          placeholder="搜尋標題或內容關鍵字..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginBottom: 14, maxWidth: 360 }}
        />

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              style={{
                padding: '6px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: activeTag === tag ? 'var(--yz-g)' : '#fff',
                color: activeTag === tag ? '#fff' : 'var(--yz-mut)',
                borderColor: activeTag === tag ? 'var(--yz-g)' : 'var(--yz-bdr)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--yz-mut)', padding: '32px 0', textAlign: 'center' }}>
            找不到符合「{q}」的文章
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
          {visible.map(article => {
            const expanded = expandedId === article.id;
            const saved = savedIds.includes(article.id);
            const related = matchedBasketItems(article, basket);
            return (
              <div
                key={article.id}
                className="yz-card"
                style={{ padding: '18px 20px', cursor: 'pointer' }}
                onClick={() => setExpandedId(expanded ? null : article.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className={`yz-bdg ${TAG_BADGE[article.tag]}`}>{article.tag}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--yz-dim)' }}>{article.date}</span>
                    <button
                      onClick={e => handleToggleSave(e, article)}
                      title={saved ? '取消收藏' : '收藏到我的菜籃'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, color: saved ? 'var(--yz-or)' : 'var(--yz-dim)' }}
                    >
                      {saved ? '★' : '☆'}
                    </button>
                  </div>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>{article.title}</h3>
                <p style={{
                  fontSize: 13, color: 'var(--yz-mut)', lineHeight: 1.7,
                  display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: expanded ? 'unset' : 2, overflow: expanded ? 'visible' : 'hidden',
                }}>
                  {article.summary}
                </p>
                {related.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--yz-or)', fontWeight: 600, marginTop: 8 }}>
                    🧺 與你的菜籃相關：{related.join('、')}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--yz-dim)' }}>資料來源：{article.source}</span>
                  <span style={{ fontSize: 12, color: 'var(--yz-g)', fontWeight: 600 }}>{expanded ? '收合 ↑' : '展開 →'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
