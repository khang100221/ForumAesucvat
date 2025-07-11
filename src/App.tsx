import React, { useState } from 'react';
import { AuthProvider } from './components/Auth/AuthProvider';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import HomePage from './components/Pages/HomePage';
import PostsPage from './components/Pages/PostsPage';
import TicketsPage from './components/Pages/TicketsPage';
import DownloadsPage from './components/Pages/DownloadsPage';
import ServersPage from './components/Pages/ServersPage';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminUsers from './components/Admin/AdminUsers';
import AdminPosts from './components/Admin/AdminPosts';
import AdminDownloads from './components/Admin/AdminDownloads';
import CategoryPage from './components/Pages/CategoryPage';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('home');

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <HomePage />;
      case 'posts':
        return <PostsPage />;
      case 'tickets':
        return <TicketsPage />;
      case 'downloads':
        return <DownloadsPage />;
      case 'servers':
        return <ServersPage />;
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'admin-users':
        return <AdminUsers />;
      case 'admin-posts':
        return <AdminPosts />;
      case 'admin-downloads':
        return <AdminDownloads />;
      default:
        if (activeView.startsWith('category-')) {
          const categoryId = parseInt(activeView.split('-')[1]);
          return <CategoryPage categoryId={categoryId} />;
        }
        if (activeView.startsWith('download-')) {
          const category = activeView.split('-')[1];
          return <DownloadsPage category={category} />;
        }
        return <HomePage />;
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Header onMenuToggle={handleMenuToggle} sidebarOpen={sidebarOpen} />
        <div className="flex">
          <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            activeView={activeView}
            setActiveView={setActiveView}
          />
          <main className="flex-1 p-6 lg:ml-0">
            {renderContent()}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}

export default App;