import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface NavbarProps {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, setIsAuthenticated }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <nav className="bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-white font-bold">PDF Manager</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                    <button onClick={handleLogout} className="text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Login</Link>
                    <Link to="/register" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Register</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;