import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search } from 'lucide-react';
import { Post } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import PostList from '../Forum/PostList';
import PostDetail from '../Forum/PostDetail';
import CreatePost from '../Forum/CreatePost';

const PostsPage: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, [searchQuery]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const url = new URL('http://localhost:3001/api/posts');
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }
      url.searchParams.append('type', 'regular');
      
      const response = await fetch(url);
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

  const handleCreatePost = () => {
    setShowCreatePost(true);
  };

  const handlePostCreated = () => {
    fetchPosts();
  };

  if (selectedPost) {
    return (
      <PostDetail 
        postId={selectedPost.id} 
        onBack={() => setSelectedPost(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Bài viết</h1>
          {user && (
            <button
              onClick={handleCreatePost}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Tạo bài viết</span>
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
              placeholder="Tìm kiếm bài viết..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2">
            <Filter size={20} />
            <span>Lọc</span>
          </button>
        </div>
      </div>

      {/* Posts List */}
      <PostList 
        onSelectPost={setSelectedPost} 
      />

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePost
          onClose={() => setShowCreatePost(false)}
          onSuccess={handlePostCreated}
        />
      )}
    </div>
  );
};

export default PostsPage;