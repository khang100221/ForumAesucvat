import React, { useState, useEffect } from 'react';
import { Category, Post } from '../../types';
import PostList from '../Forum/PostList';
import PostDetail from '../Forum/PostDetail';
import CreatePost from '../Forum/CreatePost';
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface CategoryPageProps {
  categoryId: number;
}

const CategoryPage: React.FC<CategoryPageProps> = ({ categoryId }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    fetchCategory();
  }, [categoryId]);

  const fetchCategory = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/categories');
      if (response.ok) {
        const categories = await response.json();
        const foundCategory = categories.find((cat: Category) => cat.id === categoryId);
        setCategory(foundCategory || null);
      }
    } catch (error) {
      console.error('Error fetching category:', error);
    }
  };

  if (!category) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

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
      {/* Category Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl"
              style={{ backgroundColor: category.color + '20' }}
            >
              {category.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
              <p className="text-gray-600">{category.description}</p>
            </div>
          </div>
          {user && (
            <button
              onClick={() => setShowCreatePost(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Tạo bài viết</span>
            </button>
          )}
        </div>
      </div>

      {/* Posts in Category */}
      <PostList 
        categoryId={categoryId}
        onSelectPost={setSelectedPost}
      />

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePost
          onClose={() => setShowCreatePost(false)}
          onSuccess={() => {
            setShowCreatePost(false);
            // Refresh posts list
          }}
        />
      )}
    </div>
  );
};

export default CategoryPage;