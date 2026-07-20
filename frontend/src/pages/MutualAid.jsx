import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchPosts,
  fetchPost,
  createPost,
  updatePost,
  deletePost as apiDeletePost,
  updatePostStatus as apiUpdatePostStatus,
  addComment as apiAddComment,
  deleteComment as apiDeleteComment,
  toggleLike as apiToggleLike,
  toggleSave as apiToggleSave,
  fetchSavedPosts,
  uploadImage,
} from '../lib/mutualAidApi';
import './MutualAid.css';

const TYPE_BADGE = { '滯銷急售': 'badge-orange', '求助': 'badge-red', '資訊分享': 'badge-green' };
const POST_TYPES = ['滯銷急售', '求助', '資訊分享'];
const CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '新竹縣',
  '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣',
];
const STATUS_LABEL = { open: '徵求中', dealing: '洽談中', closed: '已結束' };
const STATUS_OPTIONS = ['open', 'dealing', 'closed'];
const PAGE_SIZE = 20;
const MAX_IMAGES = 3;
const EMPTY_FORM = { type: '資訊分享', farm_name: '', location_city: '', location_addr: '', content: '', images: [] };

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function formatLocation(post) {
  return [post.location_city, post.location_addr].filter(Boolean).join(' ') || '未提供地點';
}

function ImageLightbox({ images, index, onClose, onNav }) {
  if (!images || images.length === 0) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
    >
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 18, right: 22, background: 'none', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}
      >
        ✕
      </button>
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNav(-1); }}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#fff', fontSize: 36, cursor: 'pointer', lineHeight: 1 }}
        >
          ‹
        </button>
      )}
      <img
        src={images[index]}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
      />
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNav(1); }}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#fff', fontSize: 36, cursor: 'pointer', lineHeight: 1 }}
        >
          ›
        </button>
      )}
      {images.length > 1 && (
        <span style={{ position: 'absolute', bottom: 18, color: '#fff', fontSize: 12.5 }}>{index + 1} / {images.length}</span>
      )}
    </div>
  );
}

function PostDetailModal({ postId, myId, onClose, onAuthError }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchPost(postId)
      .then(data => { if (!cancelled) setDetail(data); })
      .catch(err => { if (!cancelled) setError(err.message || '載入失敗'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId]);

  async function submitComment(e) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const comment = await apiAddComment(postId, text);
      setDetail(d => ({ ...d, comments: [...d.comments, comment] }));
      setCommentText('');
    } catch (err) {
      if (err.status === 401) onAuthError();
      else setError(err.message || '留言失敗');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeComment(commentId) {
    try {
      await apiDeleteComment(commentId);
      setDetail(d => ({ ...d, comments: d.comments.filter(c => c.id !== commentId) }));
    } catch (err) {
      if (err.status === 401) onAuthError();
      else setError(err.message || '刪除失敗');
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,55,72,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: 480, maxHeight: '85vh', overflowY: 'auto', padding: '24px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>載入中...</p>}
        {!loading && error && (
          <p className="rp-msg rp-warn">{error}</p>
        )}

        {!loading && !error && detail && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className={`badge ${TYPE_BADGE[detail.type]}`}>{detail.type}</span>
              <span className={`ma-status-chip ma-status-${detail.status}`}>{STATUS_LABEL[detail.status]}</span>
            </div>
            {detail.images?.length > 0 && (
              <div className="ma-image-list" style={{ marginBottom: 12 }}>
                {detail.images.map((url, i) => (
                  <div key={url} className="ma-image-thumb ma-image-thumb-clickable" onClick={() => setLightboxIndex(i)}>
                    <img src={url} alt="" />
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 12 }}>{detail.content}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
              {detail.author_name}{detail.farm_name ? `．${detail.farm_name}` : ''}．{formatLocation(detail)}．{formatDate(detail.created_at)}
            </p>

            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💬 {detail.comments.length} 則回應</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {detail.comments.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>還沒有回應，來當第一個吧</p>
              )}
              {detail.comments.map(c => (
                <div key={c.id} style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.author_name}．<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{formatDate(c.created_at)}</span></span>
                    {c.member_id === myId && (
                      <button className="ma-post-link ma-post-link-danger" onClick={() => removeComment(c.id)}>刪除</button>
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
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ flexShrink: 0 }}>送出</button>
            </form>
          </>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={detail?.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={d => setLightboxIndex(i => (i + d + detail.images.length) % detail.images.length)}
        />
      )}
    </div>
  );
}

function ComposeModal({ form, onChange, onSubmit, error, apiError, submitting, uploading, onAddImages, onRemoveImage, onClose }) {
  const fileInputRef = useRef(null);

  function handleFilePick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddImages(files);
    e.target.value = '';
  }

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
          <select name="location_city" className="input ma-post-location" value={form.location_city} onChange={onChange}>
            <option value="">選擇縣市</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input
          name="location_addr"
          className="input"
          placeholder="詳細地址（選填）"
          value={form.location_addr}
          onChange={onChange}
        />
        <input
          name="farm_name"
          className="input"
          placeholder="農場／攤位名稱（選填）"
          value={form.farm_name}
          onChange={onChange}
        />
        <textarea
          name="content"
          className="input ma-post-content"
          placeholder="想跟大家分享或請求協助的內容..."
          rows={4}
          value={form.content}
          onChange={onChange}
          autoFocus
        />

        <div className="ma-image-list">
          {form.images.map((url, i) => (
            <div key={url} className="ma-image-thumb">
              <img src={url} alt="" />
              <button type="button" className="ma-image-remove" onClick={() => onRemoveImage(i)}>✕</button>
            </div>
          ))}
          {form.images.length < MAX_IMAGES && (
            <button type="button" className="ma-image-add" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? '上傳中...' : '＋ 新增圖片'}
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFilePick} />

        {error && <p className="rp-msg rp-warn">請選擇所在縣市並填寫內容</p>}
        {apiError && <p className="rp-msg rp-warn">{apiError}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? '發布中...' : '發布'}</button>
      </form>
    </div>
  );
}

function DiscussionBoard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [listError, setListError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(false);
  const [composeApiError, setComposeApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ type: '', location_city: '', location_addr: '', content: '', images: [] });
  const [editImageUploading, setEditImageUploading] = useState(false);
  const editFileInputRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'saved' | 'mine'
  const [typeFilter, setTypeFilter] = useState('全部');
  const [cityFilter, setCityFilter] = useState('全部');
  const [actionError, setActionError] = useState('');
  const [authNotice, setAuthNotice] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images, index }

  const myName = user?.name || '訪客';

  function reportError(err, fallback) {
    if (err?.status === 401) setAuthNotice(true);
    else setActionError(err?.message || fallback);
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError('');
    const task = viewFilter === 'saved'
      ? fetchSavedPosts()
      : fetchPosts({ type: typeFilter, city: cityFilter, q: debouncedQuery, mine: viewFilter === 'mine', offset: 0, limit: PAGE_SIZE });
    task
      .then(data => {
        if (cancelled) return;
        setPosts(data);
        setHasMore(viewFilter !== 'saved' && data.length === PAGE_SIZE);
      })
      .catch(err => {
        if (cancelled) return;
        if (err.status === 401) { setAuthNotice(true); setViewFilter('all'); }
        else setListError(err.message || '載入失敗');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [typeFilter, cityFilter, debouncedQuery, viewFilter, reloadKey]);

  async function loadMore() {
    if (viewFilter === 'saved' || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPosts({ type: typeFilter, city: cityFilter, q: debouncedQuery, mine: viewFilter === 'mine', offset: posts.length, limit: PAGE_SIZE });
      setPosts(ps => [...ps, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      reportError(err, '載入更多失敗');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleAddImages(files) {
    const remaining = MAX_IMAGES - form.images.length;
    const toUpload = files.slice(0, remaining);
    setImageUploading(true);
    setComposeApiError('');
    try {
      for (const file of toUpload) {
        try {
          const { url } = await uploadImage(file);
          setForm(f => ({ ...f, images: [...f.images, url] }));
        } catch (err) {
          if (err.status === 401) { setAuthNotice(true); break; }
          setComposeApiError(err.message || '圖片上傳失敗');
        }
      }
    } finally {
      setImageUploading(false);
    }
  }

  function handleRemoveImage(idx) {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.location_city || !form.content.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setComposeApiError('');
    setSubmitting(true);
    try {
      const newPost = await createPost({
        type: form.type,
        content: form.content.trim(),
        farm_name: form.farm_name.trim() || undefined,
        location_city: form.location_city,
        location_addr: form.location_addr.trim() || undefined,
        images: form.images,
      });
      setPosts(ps => [newPost, ...ps]);
      setForm(EMPTY_FORM);
      setComposeOpen(false);
    } catch (err) {
      if (err.status === 401) setAuthNotice(true);
      else setComposeApiError(err.message || '發布失敗');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike(e, post) {
    e.stopPropagation();
    const prevLiked = Boolean(post.is_liked);
    const prevCount = post.like_count;
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, is_liked: !prevLiked, like_count: prevLiked ? prevCount - 1 : prevCount + 1 } : p));
    try {
      const res = await apiToggleLike(post.id);
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, is_liked: res.liked, like_count: res.like_count } : p));
    } catch (err) {
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, is_liked: prevLiked, like_count: prevCount } : p));
      reportError(err, '按讚失敗');
    }
  }

  async function handleToggleSave(e, post) {
    e.stopPropagation();
    const prevSaved = Boolean(post.is_saved);
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, is_saved: !prevSaved } : p));
    try {
      const res = await apiToggleSave(post.id);
      if (viewFilter === 'saved' && !res.saved) {
        setPosts(ps => ps.filter(p => p.id !== post.id));
      } else {
        setPosts(ps => ps.map(p => p.id === post.id ? { ...p, is_saved: res.saved } : p));
      }
    } catch (err) {
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, is_saved: prevSaved } : p));
      reportError(err, '收藏失敗');
    }
  }

  async function handleStatusChange(post, status) {
    const prevStatus = post.status;
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, status } : p));
    try {
      await apiUpdatePostStatus(post.id, status);
    } catch (err) {
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, status: prevStatus } : p));
      reportError(err, '更新狀態失敗');
    }
  }

  function startEdit(post) {
    setEditingId(post.id);
    setEditForm({
      type: post.type,
      location_city: post.location_city || '',
      location_addr: post.location_addr || '',
      content: post.content,
      images: post.images || [],
    });
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditAddImages(files) {
    const remaining = MAX_IMAGES - editForm.images.length;
    const toUpload = files.slice(0, remaining);
    setEditImageUploading(true);
    try {
      for (const file of toUpload) {
        try {
          const { url } = await uploadImage(file);
          setEditForm(f => ({ ...f, images: [...f.images, url] }));
        } catch (err) {
          if (err.status === 401) { setAuthNotice(true); break; }
          reportError(err, '圖片上傳失敗');
        }
      }
    } finally {
      setEditImageUploading(false);
    }
  }

  function handleEditRemoveImage(idx) {
    setEditForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  function handleEditFilePick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) handleEditAddImages(files);
    e.target.value = '';
  }

  async function saveEdit(id) {
    if (!editForm.location_city || !editForm.content.trim()) return;
    try {
      const updated = await updatePost(id, {
        type: editForm.type,
        location_city: editForm.location_city,
        location_addr: editForm.location_addr.trim() || undefined,
        content: editForm.content.trim(),
        images: editForm.images,
      });
      setPosts(ps => ps.map(p => p.id === id ? updated : p));
      setEditingId(null);
    } catch (err) {
      reportError(err, '更新失敗');
    }
  }

  async function handleDeletePost(id) {
    try {
      await apiDeletePost(id);
      setPosts(ps => ps.filter(p => p.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      reportError(err, '刪除失敗');
    }
  }

  const visiblePosts = posts;

  return (
    <div>
      {authNotice && (
        <p className="rp-msg rp-warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>請先登入才能使用這個功能。<Link to="/login" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>前往登入</Link></span>
          <button onClick={() => setAuthNotice(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </p>
      )}
      {actionError && (
        <p className="rp-msg rp-warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </p>
      )}

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
          onClick={() => setViewFilter(v => v === 'saved' ? 'all' : 'saved')}
          style={{
            flexShrink: 0, fontSize: 13,
            background: viewFilter === 'saved' ? 'var(--green)' : 'var(--cream-dark)',
            color: viewFilter === 'saved' ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          ★ 只看收藏
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setViewFilter(v => v === 'mine' ? 'all' : 'mine')}
          style={{
            flexShrink: 0, fontSize: 13,
            background: viewFilter === 'mine' ? 'var(--green)' : 'var(--cream-dark)',
            color: viewFilter === 'mine' ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          🙋 只看我的
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
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

      <select className="input" style={{ marginBottom: 14, maxWidth: 200 }} value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
        <option value="全部">所有縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {loading && posts.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card" style={{ height: 92, background: 'var(--cream-dark)', opacity: 0.6 }} />
          ))}
        </div>
      )}

      {!loading && listError && (
        <p className="rp-msg rp-warn" style={{ cursor: 'pointer' }} onClick={() => setReloadKey(k => k + 1)}>
          載入失敗，點此重試
        </p>
      )}

      {!loading && !listError && visiblePosts.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
          {viewFilter === 'saved' ? '還沒有收藏任何貼文'
            : viewFilter === 'mine' ? '你還沒有發布任何貼文'
            : debouncedQuery ? `找不到符合「${debouncedQuery}」的貼文` : '沒有符合篩選條件的貼文'}
        </p>
      )}

      {!loading && !listError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visiblePosts.map(post => {
            const isOwn = user && post.member_id === user.id;
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
                    <select
                      className="input ma-post-location"
                      value={editForm.location_city}
                      onChange={e => setEditForm(f => ({ ...f, location_city: e.target.value }))}
                    >
                      <option value="">選擇縣市</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <input
                    className="input"
                    placeholder="詳細地址（選填）"
                    value={editForm.location_addr}
                    onChange={e => setEditForm(f => ({ ...f, location_addr: e.target.value }))}
                  />
                  <textarea
                    className="input ma-post-content"
                    rows={3}
                    value={editForm.content}
                    onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                  />
                  <div className="ma-image-list">
                    {editForm.images.map((url, i) => (
                      <div key={url} className="ma-image-thumb">
                        <img src={url} alt="" />
                        <button type="button" className="ma-image-remove" onClick={() => handleEditRemoveImage(i)}>✕</button>
                      </div>
                    ))}
                    {editForm.images.length < MAX_IMAGES && (
                      <button
                        type="button"
                        className="ma-image-add"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={editImageUploading}
                      >
                        {editImageUploading ? '上傳中...' : '＋ 新增圖片'}
                      </button>
                    )}
                  </div>
                  <input ref={editFileInputRef} type="file" accept="image/*" multiple hidden onChange={handleEditFilePick} />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${TYPE_BADGE[post.type]}`}>{post.type}</span>
                    <span className={`ma-status-chip ma-status-${post.status}`}>{STATUS_LABEL[post.status]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(post.created_at)}</span>
                    <button
                      onClick={e => handleToggleSave(e, post)}
                      title={post.is_saved ? '取消收藏' : '收藏'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, color: post.is_saved ? '#E07B39' : 'var(--text-muted)' }}
                    >
                      {post.is_saved ? '★' : '☆'}
                    </button>
                    {isOwn && (
                      confirmDeleteId === post.id ? (
                        <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button className="ma-post-link ma-post-link-danger" onClick={() => handleDeletePost(post.id)}>確定刪除？</button>
                          <button className="ma-post-link" onClick={() => setConfirmDeleteId(null)}>取消</button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <select
                            className="input"
                            style={{ fontSize: 12, padding: '2px 6px', height: 'auto' }}
                            value={post.status}
                            onChange={e => handleStatusChange(post, e.target.value)}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                          <button className="ma-post-link" onClick={() => startEdit(post)}>編輯</button>
                          <button className="ma-post-link ma-post-link-danger" onClick={() => setConfirmDeleteId(post.id)}>刪除</button>
                        </span>
                      )
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>{post.content}</p>
                {post.images?.[0] && (
                  <div
                    className="ma-image-thumb ma-image-thumb-clickable"
                    style={{ marginBottom: 10 }}
                    onClick={e => { e.stopPropagation(); setLightbox({ images: post.images, index: 0 }); }}
                  >
                    <img src={post.images[0]} alt="" />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <span>{post.author_name}{post.farm_name ? `．${post.farm_name}` : ''}．{formatLocation(post)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                      onClick={e => handleToggleLike(e, post)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, padding: 0, color: post.is_liked ? '#E07B39' : 'var(--text-muted)' }}
                    >
                      {post.is_liked ? '♥' : '♡'} {post.like_count}
                    </button>
                    <span>💬 留言</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !listError && hasMore && viewFilter !== 'saved' && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '載入中...' : '載入更多'}
          </button>
        </div>
      )}

      {detailId && (
        <PostDetailModal
          postId={detailId}
          myId={user?.id}
          onClose={() => setDetailId(null)}
          onAuthError={() => setAuthNotice(true)}
        />
      )}

      {composeOpen && (
        <ComposeModal
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          error={error}
          apiError={composeApiError}
          submitting={submitting}
          uploading={imageUploading}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
          onClose={() => setComposeOpen(false)}
        />
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNav={d => setLightbox(l => ({ ...l, index: (l.index + d + l.images.length) % l.images.length }))}
        />
      )}
    </div>
  );
}

export default function MutualAid() {
  return (
    <div className="container ma-page">
      <h1 className="page-title">🤝 互助網</h1>
      <p className="ma-desc">滯銷、急銷媒合與栽培互助。</p>

      <DiscussionBoard />
    </div>
  );
}
