import React, { useState, useEffect } from 'react';
import { Home, MessageSquare, Download, Settings, Users, Shield, Pin, Upload, FileText, Palette, Zap, Server, HelpCircle, Bug, Crown, Activity } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Category } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, activeView, setActiveView }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, downloads: 0, online: 0 });

  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const mainMenuItems = [
    { id: 'home', icon: Home, label: 'Trang chủ', color: 'text-blue-600' },
    { id: 'posts', icon: MessageSquare, label: 'Bài viết', color: 'text-green-600' },
    { id: 'tickets', icon: HelpCircle, label: 'Tickets', color: 'text-orange-600' },
    { id: 'downloads', icon: Download, label: 'Tải xuống', color: 'text-purple-600' },
    { id: 'servers', icon: Server, label: 'Servers', color: 'text-indigo-600' },
  ];

  const forumCategories = categories.filter(cat => !cat.is_download_category);
  const downloadCategories = categories.filter(cat => cat.is_download_category);

  const adminItems = [
    { id: 'admin-dashboard', icon: Activity, label: 'Dashboard', color: 'text-red-600' },
    { id: 'admin-users', icon: Users, label: 'Quản lý người dùng', color: 'text-red-600' },
    { id: 'admin-posts', icon: Shield, label: 'Quản lý bài viết', color: 'text-red-600' },
    { id: 'admin-downloads', icon: Download, label: 'Quản lý tải xuống', color: 'text-red-600' },
    { id: 'admin-categories', icon: Settings, label: 'Quản lý danh mục', color: 'text-red-600' },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Stats */}
          <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-b">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <div className="text-lg font-bold text-green-600">{stats.users}</div>
                <div className="text-xs text-gray-600">Thành viên</div>
              </div>
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <div className="text-lg font-bold text-blue-600">{stats.posts}</div>
                <div className="text-xs text-gray-600">Bài viết</div>
              </div>
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <div className="text-lg font-bold text-purple-600">{stats.downloads}</div>
                <div className="text-xs text-gray-600">Tải xuống</div>
              </div>
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <div className="text-lg font-bold text-green-500">{stats.online}</div>
                <div className="text-xs text-gray-600">Đang online</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* Main Menu */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Menu chính
              </h3>
              {mainMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all ${
                    activeView === item.id
                      ? 'bg-green-100 text-green-700 border-l-4 border-green-500 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon size={20} className={`mr-3 ${item.color}`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Forum Categories */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Danh mục diễn đàn
              </h3>
              <div className="space-y-1">
                {forumCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveView(`category-${category.id}`)}
                    className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                      activeView === `category-${category.id}`
                        ? 'bg-green-100 text-green-700 border-l-4 border-green-500 shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-3 text-lg">{category.icon}</span>
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Download Categories */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Tải xuống
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveView('download-mods')}
                  className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                    activeView === 'download-mods'
                      ? 'bg-purple-100 text-purple-700 border-l-4 border-purple-500 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Settings size={16} className="mr-3 text-red-600" />
                  <span className="text-sm">Mods</span>
                </button>
                <button
                  onClick={() => setActiveView('download-packs')}
                  className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                    activeView === 'download-packs'
                      ? 'bg-purple-100 text-purple-700 border-l-4 border-purple-500 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Palette size={16} className="mr-3 text-green-600" />
                  <span className="text-sm">Resource Packs</span>
                </button>
                <button
                  onClick={() => setActiveView('download-shaders')}
                  className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                    activeView === 'download-shaders'
                      ? 'bg-purple-100 text-purple-700 border-l-4 border-purple-500 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Zap size={16} className="mr-3 text-yellow-600" />
                  <span className="text-sm">Shaders</span>
                </button>
                <button
                  onClick={() => setActiveView('download-configs')}
                  className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                    activeView === 'download-configs'
                      ? 'bg-purple-100 text-purple-700 border-l-4 border-purple-500 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText size={16} className="mr-3 text-gray-600" />
                  <span className="text-sm">Configs</span>
                </button>
                <button
                  onClick={() => setActiveView('download-modpacks')}
                  className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                    activeView === 'download-modpacks'
                      ? 'bg-purple-100 text-purple-700 border-l-4 border-purple-500 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Upload size={16} className="mr-3 text-indigo-600" />
                  <span className="text-sm">Modpacks</span>
                </button>
              </div>
            </div>

            {/* Admin Menu */}
            {user && (user.role === 'admin' || user.role === 'moderator') && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3 flex items-center">
                  <Crown size={12} className="mr-1" />
                  Quản trị
                </h3>
                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id)}
                      className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-all ${
                        activeView === item.id
                          ? 'bg-red-100 text-red-700 border-l-4 border-red-500 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon size={16} className={`mr-3 ${item.color}`} />
                      <span className="text-sm">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* User Status */}
          {user && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  {user.avatar ? (
                    <img src={`http://localhost:3001/uploads/${user.avatar}`} alt={user.username} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{user.username}</div>
                  <div className="text-xs text-gray-600">{user.minecraft_username}</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <span className="text-xs text-gray-500 capitalize">{user.status}</span>
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">{user.role}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;