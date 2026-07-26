import { ExternalLink } from 'lucide-react';
import './DemoOfferCards.css';

export default function DemoOfferCards({ title, description, cards }) {
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
      <div className="demo-offer-grid">
        {cards.map(card => (
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
