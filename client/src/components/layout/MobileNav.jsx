import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  HiOutlineClipboardDocumentCheck,
  HiOutlineMapPin,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineDocumentText,
  HiOutlineBuildingOffice2
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';

const MobileNav = () => {
  const { isAdmin } = useAuth();

  const navItems = [
    {
      label: 'Checklist',
      path: '/',
      icon: HiOutlineClipboardDocumentCheck,
      roles: ['admin', 'staff']
    },
    {
      label: 'Records',
      path: '/records',
      icon: HiOutlineDocumentText,
      roles: ['admin', 'staff']
    },
    {
      label: 'Hospitals',
      path: '/hospitals',
      icon: HiOutlineBuildingOffice2,
      roles: ['admin']
    },
    {
      label: 'Areas',
      path: '/areas',
      icon: HiOutlineMapPin,
      roles: ['admin']
    },
    {
      label: 'Tasks',
      path: '/tasks',
      icon: HiOutlineClipboardDocumentList,
      roles: ['admin']
    },
    {
      label: 'Users',
      path: '/users',
      icon: HiOutlineUsers,
      roles: ['admin']
    },
    {
      label: 'Reports',
      path: '/reports',
      icon: HiOutlineChartBar,
      roles: ['admin']
    }
  ];

  const filteredNavItems = navItems.filter(item => 
    isAdmin ? item.roles.includes('admin') : item.roles.includes('staff')
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
      <div className="flex items-center justify-around gap-1 px-2 py-2 overflow-x-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center flex-shrink-0 px-2 py-2 rounded-xl min-w-[52px]
              transition-all duration-200
              ${isActive 
                ? 'text-primary-600 bg-primary-50' 
                : 'text-slate-500 hover:text-slate-700'
              }
            `}
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
