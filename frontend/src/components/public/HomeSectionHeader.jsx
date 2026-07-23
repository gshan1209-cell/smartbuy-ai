export default function HomeSectionHeader({ eyebrow, title, description, children }) {
  return (
    <div className="home-section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        {description && <p className="section-description">{description}</p>}
      </div>
      {children && <div className="section-header-actions">{children}</div>}
    </div>
  );
}
