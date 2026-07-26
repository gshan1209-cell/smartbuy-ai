import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import './DemoOfferCards.css';

export default function DemoOfferCards({ title, description, cards, categoryOptions = [] }) {
  const [activeCategory, setActiveCategory] = useState('全部');
  const categoryChoices = categoryOptions.length ? ['全部', ...categoryOptions] : [];
  const visibleCards = activeCategory === '全部'
    ? cards
    : cards.filter(card => card.categories?.includes(activeCategory));

  return (
    <section className="demo-offer-section" aria-label={title}>
      <div className="demo-offer-heading">
        <div>
          <span className="demo-offer-kicker">DEMO CARD</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="demo-offer-note">示意內容</span>
      </div>
      {categoryChoices.length > 0 && (
        <div className="demo-offer-category-filter" role="group" aria-label="特賣分類">
          {categoryChoices.map(category => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? 'active' : ''}
              onClick={() => setActiveCategory(category)}
              aria-pressed={activeCategory === category}
            >
              {category}
            </button>
          ))}
        </div>
      )}
      <div className="demo-offer-grid">
        {visibleCards.map(card => (
          <article className="demo-offer-card" key={card.id}>
            <div className="demo-offer-image-wrap">
              <img src={card.image} alt={card.title} className="demo-offer-image" loading="lazy" decoding="async" />
              <span className="demo-offer-badge">{card.badge}</span>
            </div>
            <div className="demo-offer-card-body">
              <div className="demo-offer-merchant">
                <span className="demo-offer-merchant-icon" aria-hidden="true">{card.merchantIcon}</span>
                <span>{card.merchantName}</span>
              </div>
              {card.categories?.length > 0 && (
                <div className="demo-offer-categories" aria-label="卡片分類">
                  {card.categories.map(category => (
                    <span className={category === '免費贈送' ? 'is-free' : ''} key={category}>{category}</span>
                  ))}
                </div>
              )}
              <h3>{card.title}</h3>
              <p className="demo-offer-description">{card.description}</p>
              <div className="demo-offer-price-row">
                <strong>{card.price}</strong>
                <span>{card.originalPrice}</span>
              </div>
              <p className="demo-offer-note-line">{card.offerNote}</p>
              <a className="demo-offer-link" href={card.websiteUrl} target="_blank" rel="noreferrer">
                查看商家介紹 <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
