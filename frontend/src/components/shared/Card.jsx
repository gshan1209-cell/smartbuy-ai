export default function Card({ className='', children, ...props }) { return <section className={`ui-card ${className}`} {...props}>{children}</section>; }
