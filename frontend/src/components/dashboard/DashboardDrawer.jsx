import Drawer from '../shared/Drawer'; import DashboardSidebar from './DashboardSidebar';
export default function DashboardDrawer({open,onClose}){return <Drawer open={open} onClose={onClose} title="後台選單"><DashboardSidebar onNavigate={onClose}/></Drawer>}
