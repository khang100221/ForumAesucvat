import React, { useState, useEffect } from 'react';
import { MessageSquare, Download, Users, TrendingUp, Clock, Eye, Heart, Pin, Star, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Post {
  id: number;
  title: string;
  content: string;
  username: string;
  avatar?: string;
  role: string;
  category_name: string;
  category_color: string;
  views: number;
  comment_count: number;
  reaction_count: number;
  pinned: boolean;
  created_at: string;
}

interface DownloadItem {
  id: number;
  name: string;
  description: string;
  category: string;
  version: string;
  minecraft_version: string;
  downloads: number;
  featured: boolean;
  created_at: string;
}

interface Stats {
  users: number;
  posts: number;
  downloads: number;
  online: number;
}

const HomePage: React.FC = () => {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [featuredDownloads, setFeaturedDownloads] = useState<DownloadItem[]>([]);
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
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-amber-600 rounded-xl flex items-center justify-center mr-4 shadow-lg border-2 border-amber-700">
              <span className="text-3xl">⛏️</span>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                AESUCVAT
              </h1>
              <p className="text-xl text-green-100">
                Cộng đồng Minecraft hàng đầu Việt Nam
              </p>
            </div>
          </div>
          <p className="text-lg text-green-100 mb-8 max-w-2xl mx-auto">
            Nơi chia sẻ kiến thức, mods, resource packs và kết nối với hàng nghìn game thủ Minecraft đam mê
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-30">
              <div className="text-3xl font-bold">{stats.users}</div>
              <div className="text-sm text-green-100">Thành viên</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-30">
              <div className="text-3xl font-bold">{stats.posts}</div>
              <div className="text-sm text-green-100">Bài viết</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-30">
              <div className="text-3xl font-bold">{stats.downloads}</div>
              <div className="text-sm text-green-100">Tải xuống</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-30">
              <div className="text-3xl font-bold text-green-300">{stats.online}</div>
              <div className="text-sm text-green-100">Đang online</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="mr-3 text-green-600" size={28} />
              Bài viết mới nhất
            </h2>
            <button className="text-green-600 hover:text-green-700 text-sm font-medium bg-green-100 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors">
              Xem tất cả →
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {recentPosts.length > 0 ? recentPosts.map((post) => (
            <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-3">
                    {post.pinned && <Pin size={16} className="text-red-500" />}
                    <span 
                      className="px-3 py-1 text-xs rounded-full text-white font-medium shadow-sm"
                      style={{ backgroundColor: post.category_color }}
                    >
                      {post.category_name}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-green-600 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                    {post.content.substring(0, 150)}...
                  </p>
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <span className="flex items-center font-medium">
                      <span className="text-gray-700">{post.username}</span>
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
                <div className="ml-6 flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-md">
                    {post.avatar ? (
                      <img 
                        src={`http://localhost:3001/uploads/${post.avatar}`} 
                        alt={post.username} 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {post.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Chưa có bài viết nào</p>
            </div>
          )}
        </div>
      </div>

      {/* Featured Downloads */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Download className="mr-3 text-purple-600" size={28} />
              Tải xuống nổi bật
            </h2>
            <button className="text-purple-600 hover:text-purple-700 text-sm font-medium bg-purple-100 px-4 py-2 rounded-lg hover:bg-purple-200 transition-colors">
              Xem tất cả →
            </button>
          </div>
        </div>
        <div className="p-6">
          {featuredDownloads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredDownloads.map((download) => (
                <div key={download.id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 cursor-pointer border border-gray-200 hover:border-purple-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">
                      {download.category}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Star size={14} className="text-yellow-500" />
                      <span className="text-xs text-gray-500">{download.downloads}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">{download.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                    {download.description.substring(0, 80)}...
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="bg-white px-2 py-1 rounded font-medium">v{download.version}</span>
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">MC {download.minecraft_version}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Download size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Chưa có file tải xuống nào</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Tạo bài viết</h3>
            <MessageSquare size={28} className="opacity-80" />
          </div>
          <p className="text-green-100 mb-6 leading-relaxed">Chia sẻ kiến thức và kinh nghiệm Minecraft của bạn với cộng đồng</p>
          <button className="bg-white text-green-600 px-6 py-3 rounded-lg hover:bg-green-50 transition-colors font-medium shadow-md">
            Tạo ngay →
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Upload mod</h3>
            <Download size={28} className="opacity-80" />
          </div>
          <p className="text-purple-100 mb-6 leading-relaxed">Chia sẻ mods, packs, shaders tuyệt vời với hàng nghìn người chơi</p>
          <button className="bg-white text-purple-600 px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors font-medium shadow-md">
            Upload ngay →
          </button>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Tham gia server</h3>
            <Users size={28} className="opacity-80" />
          </div>
          <p className="text-blue-100 mb-6 leading-relaxed">Khám phá các server Minecraft đa dạng và thú vị</p>
          <button className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow-md">
            Xem server →
          </button>
        </div>
      </div>

      {/* Community Stats */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
        <div className="flex items-center justify-center mb-4">
          <Activity className="mr-3 text-amber-600" size={28} />
          <h3 className="text-xl font-bold text-gray-900">Hoạt động cộng đồng</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-amber-600">24/7</div>
            <div className="text-sm text-gray-600">Server online</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">1000+</div>
            <div className="text-sm text-gray-600">Mods & Packs</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">50+</div>
            <div className="text-sm text-gray-600">Hướng dẫn</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">∞</div>
            <div className="text-sm text-gray-600">Sáng tạo</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;