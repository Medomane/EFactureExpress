import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  onCollapse: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCollapse }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
        onCollapse(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [onCollapse]);

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapse(newState);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const NavLinks = () => (
    <div className="space-y-1">
      <Link
        to="/"
        className={`flex items-center px-6 py-3 transition-all duration-200 rounded-lg mx-2 ${
          isActive('/') 
            ? 'text-blue-600 bg-blue-50 border-l-4 border-blue-600 font-medium' 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        {(!isCollapsed || isMobile) && <span className="ml-3">Dashboard</span>}
      </Link>

      <Link
        to="/invoices"
        className={`flex items-center px-6 py-3 transition-all duration-200 rounded-lg mx-2 ${
          isActive('/invoices') 
            ? 'text-blue-600 bg-blue-50 border-l-4 border-blue-600 font-medium' 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {(!isCollapsed || isMobile) && <span className="ml-3">Invoices</span>}
      </Link>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-40 flex items-center justify-between px-4">
          <h1 className="text-xl font-bold text-gray-800">EFacture</h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setIsMobileMenuOpen(false)}>
            <div 
              className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <h1 className="text-2xl font-bold text-gray-800">EFacture</h1>
              </div>
              <nav className="mt-6">
                <NavLinks />
              </nav>
              <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
                <div className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="ml-3">User Profile</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div 
      className={`fixed inset-y-0 left-0 bg-white shadow-lg transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        {!isCollapsed && <h1 className="text-2xl font-bold text-gray-800">EFacture</h1>}
        <button
          onClick={handleCollapse}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      <nav className="mt-6">
        <NavLinks />
      </nav>

      <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
        <div className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {!isCollapsed && <span className="ml-3">User Profile</span>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 