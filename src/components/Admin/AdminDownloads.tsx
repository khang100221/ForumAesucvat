import React, { useState, useEffect } from 'react';
import { Download, Star, Check, X, Eye, Search } from 'lucide-react';
import { Download as DownloadType } from '../../types';

const AdminDownloads: React.FC = () => {
  const [downloads, setDownloads] = useState<DownloadType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDownloads();
  }, []);

  const fetchDownloads = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/downloads');
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

  const updateDownload = async (downloadId: number, updates: { approved?: boolean; featured?: boolean }) => {
    try {
      const response = await fetch(`http://localhost:3001/api/admin/downloads/${downloadId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('aesucvat_token')}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        await fetchDownloads();
      }
    } catch (error) {
      console.error('Error updating download:', error);
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

  const filteredDownloads = downloads.filter(download => 
    download.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    download.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quản lý tải xuống</h1>
        <p className="text-gray-600">Duyệt và quản lý các file tải xuống</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm file..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Downloads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tác giả
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Danh mục
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thống kê
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDownloads.map((download) => (
                  <tr key={download.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {download.name}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {download.description}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          v{download.version} • MC {download.minecraft_version}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {download.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        {download.minecraft_username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(download.category)}`}>
                        {download.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Download size={14} className="mr-1" />
                          {download.downloads}
                        </div>
                        <div className="text-xs">
                          {(download.file_size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          download.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {download.approved ? 'Đã duyệt' : 'Chờ duyệt'}
                        </span>
                        {download.featured && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Star size={12} className="mr-1" />
                            Nổi bật
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateDownload(download.id, { approved: !download.approved })}
                          className={`p-1 rounded ${
                            download.approved ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={download.approved ? 'Từ chối' : 'Duyệt'}
                        >
                          {download.approved ? <X size={16} /> : <Check size={16} />}
                        </button>
                        <button
                          onClick={() => updateDownload(download.id, { featured: !download.featured })}
                          className={`p-1 rounded ${
                            download.featured ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          title={download.featured ? 'Bỏ nổi bật' : 'Đặt nổi bật'}
                        >
                          <Star size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDownloads;