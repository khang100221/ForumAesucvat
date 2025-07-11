import React, { useState, useEffect } from 'react';
import { Download, Upload, Search, Filter, Star, Eye, Calendar } from 'lucide-react';
import { Download as DownloadType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DownloadsPageProps {
  category?: string;
}

const DownloadsPage: React.FC<DownloadsPageProps> = ({ category }) => {
  const { user } = useAuth();
  const [downloads, setDownloads] = useState<DownloadType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDownloads();
  }, [category, searchQuery, sortBy]);

  const fetchDownloads = async () => {
    try {
      setLoading(true);
      const url = new URL('http://localhost:3001/api/downloads');
      if (category) {
        url.searchParams.append('category', category);
      }
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDownloads(data);
      }
    } catch (error) {
      console.error('Error fetching downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (downloadId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/downloads/${downloadId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `download-${downloadId}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'mods':
        return 'Mods';
      case 'packs':
        return 'Resource Packs';
      case 'shaders':
        return 'Shaders';
      case 'configs':
        return 'Configs';
      case 'modpacks':
        return 'Modpacks';
      default:
        return 'Tất cả';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'mods':
        return 'bg-red-100 text-red-800';
      case 'packs':
        return 'bg-green-100 text-green-800';
      case 'shaders':
        return 'bg-yellow-100 text-yellow-800';
      case 'configs':
        return 'bg-gray-100 text-gray-800';
      case 'modpacks':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {getCategoryName(category || '')} Downloads
          </h1>
          {user && (user.role === 'admin' || user.role === 'uploader') && (
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2">
              <Upload size={20} />
              <span>Upload file</span>
            </button>
          )}
        </div>
        
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm mods, packs, shaders..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="newest">Mới nhất</option>
            <option value="popular">Phổ biến nhất</option>
            <option value="downloads">Tải nhiều nhất</option>
            <option value="name">Tên A-Z</option>
          </select>
        </div>
      </div>

      {/* Downloads Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : downloads.length === 0 ? (
        <div className="text-center py-12">
          <Download size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Không có file nào trong danh mục này</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {downloads.map((download) => (
            <div key={download.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getCategoryColor(download.category)}`}>
                        {getCategoryName(download.category)}
                      </span>
                      {download.featured && (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium flex items-center space-x-1">
                          <Star size={12} />
                          <span>Nổi bật</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{download.name}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {download.description}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center">
                      <Eye size={14} className="mr-1" />
                      {download.downloads} lượt tải
                    </span>
                    <span className="flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {formatDistanceToNow(new Date(download.created_at), { 
                        addSuffix: true, 
                        locale: vi 
                      })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-600">Version: <span className="font-medium">{download.version}</span></div>
                      <div className="text-gray-600">MC: <span className="font-medium">{download.minecraft_version}</span></div>
                      <div className="text-gray-600">Tác giả: <span className="font-medium">{download.username}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {(download.file_size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDownload(download.id)}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download size={16} />
                    <span>Tải xuống</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadsPage;