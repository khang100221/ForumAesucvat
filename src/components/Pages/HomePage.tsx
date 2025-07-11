import React, { useState, useEffect } from 'react';
import { MessageSquare, Download, Users, TrendingUp, Clock, Eye, Heart, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Post, Download as DownloadType, Stats } from '../../types';

const HomePage: React.FC = () => {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [featuredDownloads, setFeaturedDownloads] = useState<DownloadType[]>([]);
  const [stats, setStats] = useState<Stats>({ users: 0, posts: 0, downloads: 0, online: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent posts
      const postsResponse = await fetch('http://localhost:3001/api/posts?limit=5');
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        setRecentPosts(postsData);
      }

      // Fetch featured downloads
      const downloadsResponse = await fetch('http://localhost:3001/api/downloads?featured=1&limit=4');
      if (downloadsResponse.ok) {
        const downloadsData = await downloadsResponse.json();
        setFeaturedDownloads(downloadsData);
      }

      // Fetch stats
      const statsResponse = await fetch('http://localhost:3001/api/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl p-8 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Chào mừng đến với AESUCVAT
          </h1>
          <p className="text-xl text-green-100 mb-6">
            Cộng đồng Minecraft hàng đầu Việt Nam - Nơi chia sẻ kiến thức, mods, và kết nối game thủ
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 min-w-[120px]">
              <div className="text-2xl font-bold">{stats.users}</div>
              <div className="text-sm text-green-100">Thành viên</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 min-w-[120px]">
              <div className="text-2xl font-bold">{stats.posts}</div>
              <div className="text-sm text-green-100">Bài viết</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 min-w-[120px]">
              <div className="text-2xl font-bold">{stats.downloads}</div>
              <div className="text-sm text-green-100">Tải xuống</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 min-w-[120px]">
              <div className="text-2xl font-bold">{stats.online}</div>
              <div className="text-sm text-green-100">Đang online</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <TrendingUp className="mr-2 text-green-600" size={24} />
              Bài viết mới nhất
            </h2>
            <button className="text-green-600 hover:text-green-700 text-sm font-medium">
              Xem tất cả
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentPosts.map((post) => (
            <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {post.pinned && <Pin size={16} className="text-red-500" />}
                    <span 
                      className="px-2 py-1 text-xs rounded-full text-white font-medium"
                      style={{ backgroundColor: post.category_color }}
                    >
                      {post.category_name}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-green-600 cursor-pointer">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 mb-3 line-clamp-2">
                    {post.content.substring(0, 150)}...
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <span className="font-medium text-gray-700">{post.username}</span>
                      {post.role === 'admin' && <span className="ml-1 text-yellow-500">👑</span>}
                      {post.role === 'moderator' && <span className="ml-1 text-blue-500">🛡️</span>}
                    </span>
                    <span className="flex items-center">
                      <Clock size={14} className="mr-1" />
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}
                    </span>
                    <span className="flex items-center">
                      <Eye size={14} className="mr-1" />
                      {post.views}
                    </span>
                    <span className="flex items-center">
                      <MessageSquare size={14} className="mr-1" />
                      {post.comment_count}
                    </span>
                    <span className="flex items-center">
                      <Heart size={14} className="mr-1" />
                      {post.reaction_count}
                    </span>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    {post.avatar ? (
                      <img 
                        src={`http://localhost:3001/uploads/${post.avatar}`} 
                        alt={post.username} 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    ) : (
                      <span className="text-white font-bold">
                        {post.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Downloads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Download className="mr-2 text-purple-600" size={24} />
              Tải xuống nổi bật
            </h2>
            <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
              Xem tất cả
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
          {featuredDownloads.map((download) => (
            <div key={download.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">
                  {download.category}
                </span>
                <span className="text-xs text-gray-500">{download.downloads} tải</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{download.name}</h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {download.description.substring(0, 100)}...
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>v{download.version}</span>
                <span>MC {download.minecraft_version}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Tạo bài viết</h3>
            <MessageSquare size={24} />
          </div>
          <p className="text-green-100 mb-4">Chia sẻ kiến thức và kinh nghiệm của bạn</p>
          <button className="bg-white text-green-600 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors">
            Tạo ngay
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Upload mod</h3>
            <Download size={24} />
          </div>
          <p className="text-purple-100 mb-4">Chia sẻ mods tuyệt vời với cộng đồng</p>
          <button className="bg-white text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors">
            Upload ngay
          </button>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Tham gia server</h3>
            <Users size={24} />
          </div>
          <p className="text-blue-100 mb-4">Khám phá các server Minecraft đa dạng</p>
          <button className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
            Xem server
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;