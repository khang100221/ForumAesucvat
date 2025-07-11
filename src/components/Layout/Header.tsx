import React, { useState, useEffect } from 'react';
import { User, Settings, LogOut, Bell, Search, Menu, X, Crown, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LoginModal from '../Auth/LoginModal';
import RegisterModal from '../Auth/RegisterModal';

interface HeaderProps {
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, sidebarOpen }) => {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('aesucvat_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement search functionality
      console.log('Search:', searchQuery);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown size={16} className="text-yellow-500" />;
      case 'moderator':
        return <Shield size={16} className="text-blue-500" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      case 'uploader':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <header className="bg-gradient-to-r from-green-700 via-green-600 to-green-500 shadow-lg border-b-4 border-green-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Menu Toggle */}
            <div className="flex items-center">
              <button
                onClick={onMenuToggle}
                className="lg:hidden p-2 rounded-md text-white hover:bg-green-600 transition-colors"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <div className="flex items-center ml-4 lg:ml-0">
                <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center mr-3 shadow-md border-2 border-amber-700">
                  <span className="text-white font-bold text-xl">⛏️</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-wide">
                    AESUCVAT
                  </h1>
                  <span className="text-xs text-green-100 -mt-1 block">Minecraft Forum</span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm bài viết, người dùng, mods..."
                  className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border-2 border-green-300 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition-all"
                />
              </div>
            </form>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  {/* Notifications */}
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 text-white hover:bg-green-600 rounded-lg transition-colors relative"
                    >
                      <Bell size={20} />
                      {notifications.filter((n: any) => !n.read).length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {notifications.filter((n: any) => !n.read).length}
                        </span>
                      )}
                    </button>
                    
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                        <div className="p-4 border-b">
                          <h3 className="font-semibold text-gray-900">Thông báo</h3>
                        </div>
                        {notifications.length > 0 ? (
                          notifications.slice(0, 5).map((notification: any) => (
                            <div key={notification.id} className={`p-4 border-b hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}>
                              <div className="font-medium text-gray-900">{notification.title}</div>
                              <div className="text-sm text-gray-600">{notification.message}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(notification.created_at).toLocaleString('vi-VN')}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            Không có thông báo nào
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 p-2 text-white hover:bg-green-600 rounded-lg transition-colors"
                    >
                      <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center">
                        {user.avatar ? (
                          <img src={`http://localhost:3001/uploads/${user.avatar}`} alt={user.username} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User size={18} />
                        )}
                      </div>
                      <div className="hidden sm:block text-left">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{user.username}</span>
                          {getRoleIcon(user.role)}
                        </div>
                        <div className="text-xs text-green-100">
                          {user.minecraft_username || 'Minecraft Player'}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-4 border-b">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                              {user.avatar ? (
                                <img src={`http://localhost:3001/uploads/${user.avatar}`} alt={user.username} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <User size={24} />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.username}</div>
                              <div className="text-sm text-gray-600">{user.minecraft_username}</div>
                              <span className={`inline-block px-2 py-1 text-xs rounded-full ${getRoleColor(user.role)}`}>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="py-2">
                          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <Settings size={16} className="mr-2" />
                            Cài đặt tài khoản
                          </button>
                          <button 
                            onClick={logout}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                          >
                            <LogOut size={16} className="mr-2" />
                            Đăng xuất
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-4 py-2 text-white hover:bg-green-600 rounded-lg transition-colors"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium"
                  >
                    Đăng ký
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToRegister={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
      />
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
      />
    </>
  );
};

export default Header;