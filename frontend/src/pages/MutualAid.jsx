import { useState } from 'react';
import ReportPrice from './ReportPrice';
import { useAuth } from '../context/AuthContext';
import { loadSavedPostIds, toggleSavedPostId } from '../lib/savedPosts';
import './MutualAid.css';

// mock 資料：社群討論串尚無後端支援，先以示範內容呈現版型，
// 待留言功能開發後改為真實資料，元件介面不須更動。新發布的貼文只存在畫面狀態，重新整理會消失。
const INITIAL_POSTS = [
  {
    id: 1,
    type: '滯銷急售',
    author: '阿仁',
    location: '雲林縣',
    date: '2026-07-01',
    content: '絲瓜盛產產量過大，園子裡還有 300 斤左右賣不掉，願意用市價六折出清，也歡迎以物易物換飼料或資材，有興趣的鄉親留言。',
    comments: [
      { id: 101, author: '阿財', date: '2026-07-01', content: '我要 50 斤，可以留給我嗎？' },
      { id: 102, author: '玉蘭', date: '2026-07-02', content: '願意用自家的雞蛋跟你換，有興趣私訊我。' },
    ],
  },
  {
    id: 2,
    type: '求助',
    author: '美惠姐',
    location: '南投縣',
    date: '2026-06-30',
    content: '颱風預警來了，棚架還沒加固完，人手不夠，這週六上午徵求鄰近農友幫忙，工資照算，中午管一頓飯。',
    comments: [
      { id: 201, author: '志豪', date: '2026-06-30', content: '週六早上我有空，算我一個。' },
    ],
  },
  {
    id: 3,
    type: '資訊分享',
    author: '志豪',
    location: '彰化縣',
    date: '2026-06-29',
    content: '這兩週甘藍價格明顯回穩，田邊詢價的盤商也變多了，之前觀望的朋友可以評估出貨時機了。',
    comments: [
      { id: 301, author: '陳大哥', date: '2026-06-29', content: '謝謝分享，我這邊也感覺到了，準備這兩天出貨。' },
    ],
  },
  {
    id: 4,
    type: '滯銷急售',
    author: '陳大哥',
    location: '台南市',
    date: '2026-06-27',
    content: '香蕉這批熟過頭了，賣相不好但口感沒問題，適合做果乾或加工用，量大可議價，需要的人快聯絡。',
    comments: [],
  },
  {
    id: 5,
    type: '求助',
    author: '阿財',
    location: '嘉義縣',
    date: '2026-06-26',
    content: '家裡的曳引機這週送修，想跟附近有多一台的朋友借用兩天整地，願意付租金或以工換工。',
    comments: [
      { id: 501, author: '阿仁', date: '2026-06-26', content: '我這台週末沒排，你要用直接來牽。' },
    ],
  },
  {
    id: 6,
    type: '資訊分享',
    author: '玉蘭',
    location: '屏東縣',
    date: '2026-06-24',
    content: '最近豪雨後葉菜類病斑變多，噴藥前建議先剪除病葉集中銷毀，能有效減緩擴散，跟大家分享一下經驗。',
    comments: [
      { id: 601, author: '美惠姐', date: '2026-06-25', content: '這招有用，我這邊照做後病斑真的變少了。' },
      { id: 602, author: '志豪', date: '2026-06-25', content: '請問剪下來的病葉怎麼處理比較好？直接埋土裡可以嗎？' },
    ],
  },
];

const TYPE_BADGE = { '滯銷急售': 'badge-orange', '求助': 'badge-red', '資訊分享': 'badge-green' };
const POST_TYPES = ['滯銷急售', '求助', '資訊分享'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function PostDetailModal({ post, myName, onClose, onAddComment, onDeleteComment }) {
  const [commentText, setCommentText] = useState('');

  function submitComment(e) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    onAddComment(post.id, text);
    setCommentText('');
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,55,72,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: 480, maxHeight: '85vh', overflowY: 'auto', padding: '24px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className={`badge ${TYPE_BADGE[post.type]}`}>{post.type}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 12 }}>{post.content}</p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>{post.author}．{post.location}．{post.date}</p>

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💬 {post.comments.length} 則回應</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {post.comments.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>還沒有回應，來當第一個吧</p>
          )}
          {post.comments.map(c => (
            <div key={c.id} style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.author}．<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{c.date}</span></span>
                {c.author === myName && (
                  <button className="ma-post-link ma-post-link-danger" onClick={() => onDeleteComment(post.id, c.id)}>刪除</button>
                )}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{c.content}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submitComment} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="留個回應..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" style={{ flexShrink: 0 }}>送出</button>
        </form>
      </div>
    </div>
  );
}

function ComposeModal({ form, onChange, onSubmit, error, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,55,72,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
    >
      <form onSubmit={onSubmit} onClick={e => e.stopPropagation()} className="card ma-post-form" style={{ width: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>發布貼文</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="ma-post-row">
          <select name="type" className="input ma-post-type" value={form.type} onChange={onChange}>
            {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            name="location"
            className="input ma-post-location"
            placeholder="所在地，例如：雲林縣"
            value={form.location}
            onChange={onChange}
          />
        </div>
        <textarea
          name="content"
          className="input ma-post-content"
          placeholder="想跟大家分享或請求協助的內容..."
          rows={4}
          value={form.content}
          onChange={onChange}
          autoFocus
        />
        {error && <p className="rp-msg rp-warn">請填寫所在地與內容</p>}
        <button className="btn btn-primary" type="submit">發布</button>
      </form>
    </div>
  );
}

function DiscussionBoard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [form, setForm] = useState({ type: '資訊分享', location: '', content: '' });
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ type: '', location: '', content: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [savedIds, setSavedIds] = useState(loadSavedPostIds);
  const [onlySaved, setOnlySaved] = useState(false);
  const [typeFilter, setTypeFilter] = useState('全部');
  const myName = user?.name || '訪客';

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.location.trim() || !form.content.trim()) {
      setError(true);
      return;
    }
    const newPost = {
      id: Date.now(),
      type: form.type,
      author: user?.name || '訪客',
      location: form.location.trim(),
      date: today(),
      content: form.content.trim(),
      comments: [],
    };
    setPosts(p => [newPost, ...p]);
    setForm({ type: '資訊分享', location: '', content: '' });
    setError(false);
    setComposeOpen(false);
  }

  function toggleSave(e, id) {
    e.stopPropagation();
    setSavedIds(toggleSavedPostId(id));
  }

  const q = query.trim();
  const visiblePosts = posts
    .filter(p => !q || p.content.includes(q) || p.location.includes(q) || p.author.includes(q))
    .filter(p => !onlySaved || savedIds.includes(p.id))
    .filter(p => typeFilter === '全部' || p.type === typeFilter);

  function startEdit(post) {
    setEditingId(post.id);
    setEditForm({ type: post.type, location: post.location, content: post.content });
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id) {
    if (!editForm.location.trim() || !editForm.content.trim()) return;
    setPosts(ps => ps.map(p => p.id === id
      ? { ...p, type: editForm.type, location: editForm.location.trim(), content: editForm.content.trim() }
      : p
    ));
    setEditingId(null);
  }

  function deletePost(id) {
    setPosts(ps => ps.filter(p => p.id !== id));
    setConfirmDeleteId(null);
  }

  function addComment(postId, text) {
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, comments: [...p.comments, { id: Date.now(), author: myName, date: today(), content: text }] }
      : p
    ));
  }

  function deleteComment(postId, commentId) {
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, comments: p.comments.filter(c => c.id !== commentId) }
      : p
    ));
  }

  const detailPost = posts.find(p => p.id === detailId);

  return (
    <div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
        目前為示範內容，發布的貼文僅存在畫面中，重新整理會消失
      </p>

      <button type="button" className="card ma-post-trigger" onClick={() => setComposeOpen(true)}>
        <span className="ma-post-trigger-avatar">{myName[0]}</span>
        <span className="ma-post-trigger-text">有滯銷品項要出清，或需要幫忙嗎？點這裡發布...</span>
      </button>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          className="input"
          placeholder="搜尋貼文內容、地點或發布者..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          onClick={() => setOnlySaved(v => !v)}
          style={{
            flexShrink: 0, fontSize: 13,
            background: onlySaved ? 'var(--green)' : 'var(--cream-dark)',
            color: onlySaved ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          ★ 只看收藏
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['全部', ...POST_TYPES].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            style={{
              padding: '5px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: '1px solid',
              background: typeFilter === t ? 'var(--green)' : '#fff',
              color: typeFilter === t ? '#fff' : 'var(--text-muted)',
              borderColor: typeFilter === t ? 'var(--green)' : 'var(--border)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {visiblePosts.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
          {onlySaved && !savedIds.length ? '還沒有收藏任何貼文' : q ? `找不到符合「${q}」的貼文` : '沒有符合篩選條件的貼文'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visiblePosts.map(post => {
          const isOwn = post.author === myName;
          const isEditing = editingId === post.id;

          if (isEditing) {
            return (
              <div key={post.id} className="card ma-post-form">
                <div className="ma-post-row">
                  <select
                    className="input ma-post-type"
                    value={editForm.type}
                    onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  >
                    {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    className="input ma-post-location"
                    value={editForm.location}
                    onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <textarea
                  className="input ma-post-content"
                  rows={3}
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => saveEdit(post.id)}>儲存</button>
                  <button className="btn btn-secondary" onClick={cancelEdit}>取消</button>
                </div>
              </div>
            );
          }

          return (
            <div key={post.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setDetailId(post.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className={`badge ${TYPE_BADGE[post.type]}`}>{post.type}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{post.date}</span>
                  <button
                    onClick={e => toggleSave(e, post.id)}
                    title={savedIds.includes(post.id) ? '取消收藏' : '收藏'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, color: savedIds.includes(post.id) ? '#E07B39' : 'var(--text-muted)' }}
                  >
                    {savedIds.includes(post.id) ? '★' : '☆'}
                  </button>
                  {isOwn && (
                    confirmDeleteId === post.id ? (
                      <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button className="ma-post-link ma-post-link-danger" onClick={() => deletePost(post.id)}>確定刪除？</button>
                        <button className="ma-post-link" onClick={() => setConfirmDeleteId(null)}>取消</button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button className="ma-post-link" onClick={() => startEdit(post)}>編輯</button>
                        <button className="ma-post-link ma-post-link-danger" onClick={() => setConfirmDeleteId(post.id)}>刪除</button>
                      </span>
                    )
                  )}
                </div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>{post.content}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span>{post.author}．{post.location}</span>
                <span>💬 {post.comments.length} 則回應</span>
              </div>
            </div>
          );
        })}
      </div>

      {detailPost && (
        <PostDetailModal
          post={detailPost}
          myName={myName}
          onClose={() => setDetailId(null)}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
        />
      )}

      {composeOpen && (
        <ComposeModal
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          error={error}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}

export default function MutualAid() {
  const [tab, setTab] = useState('discussion');

  return (
    <div className="container ma-page">
      <h1 className="page-title">🤝 互助網</h1>
      <p className="ma-desc">滯銷、急銷媒合與栽培互助，也能在這裡回報看到的實際市場價格。</p>

      <div className="ma-tabs">
        <button className={`ma-tab ${tab === 'discussion' ? 'active' : ''}`} onClick={() => setTab('discussion')}>社群討論</button>
        <button className={`ma-tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>回報菜價</button>
      </div>

      {tab === 'discussion' ? <DiscussionBoard /> : <ReportPrice />}
    </div>
  );
}
