import React, { useState, useEffect } from 'react';
import { MessageSquare, Pin, Lock, Trash2, Eye, Search, Filter } from 'lucide-react';
import { Post } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const AdminPosts: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePin = async (postId: number, pinned: boolean) => {
    try {
      const response = await fetch(`http://localhost:3001/api/admin/posts/${postId}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('aesucvat_token')}`,
        },
        body: JSON.stringify({ pinned }),
      });
      
      if (response.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const toggleLock = async (postId: number, locked: boolean) => {
    try {
      const response = await fetch(`http://localhost:3001/api/admin/posts/${postId}/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('aesucvat_token')}`,
        },
        body: JSON.stringify({ locked }),
      });
      
      if (response.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
    }
  };

  const deletePost = async (postId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('aesucvat_token')}`,
        },
      });
      
      if (response.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quản lý bài viết</h1>
        <p className="text-gray-600">Quản lý tất cả bài viết và tickets trên diễn đàn</p>
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
              placeholder="Tìm kiếm bài viết..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Posts Table */}
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
                    Bài viết
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
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {post.title}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {post.content.substring(0, 100)}...
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          {post.avatar ? (
                            <img 
                              src={`http://localhost:3001/uploads/${post.avatar}`} 
                              alt={post.username} 
                              className="w-full h-full rounded-full object-cover" 
                            />
                          ) : (
                            <span className="text-gray-700 text-sm font-medium">
                              {post.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">
                            {post.username}
                          </div>
                          <div className="text-xs text-gray-500">
                            {post.role}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: post.category_color }}
                      >
                        {post.category_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Eye size={14} className="mr-1" />
                          {post.views}
                        </div>
                        <div className="flex items-center">
                          <MessageSquare size={14} className="mr-1" />
                          {post.comment_count}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {post.pinned && (
                          <Pin size={16} className="text-red-500" />
                        )}
                        {post.locked && (
                          <Lock size={16} className="text-gray-500" />
                        )}
                        {post.is_ticket && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                            Ticket
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => togglePin(post.id, !post.pinned)}
                          className={`p-1 rounded ${
                            post.pinned ? 'text-red-600 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          title={post.pinned ? 'Bỏ ghim' : 'Ghim bài viết'}
                        >
                          <Pin size={16} />
                        </button>
                        <button
                          onClick={() => toggleLock(post.id, !post.locked)}
                          className={`p-1 rounded ${
                            post.locked ? 'text-orange-600 hover:bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          title={post.locked ? 'Mở khóa' : 'Khóa bài viết'}
                        >
                          <Lock size={16} />
                        </button>
                        <button
                          onClick={() => deletePost(post.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Xóa bài viết"
                        >
                          <Trash2 size={16} />
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

export default AdminPosts;