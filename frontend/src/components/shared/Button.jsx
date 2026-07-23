export default function Button({ variant='primary', className='', children, ...props }) { return <button className={`ui-button ui-button-${variant} ${className}`} {...props}>{children}</button>; }
