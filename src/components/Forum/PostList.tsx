import React, { useState, useEffect } from 'react';
import { MessageSquare, Eye, Heart, Pin, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Post } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface PostListProps {
  categoryId?: number;
  onSelectPost: (post: Post) => void;
}

const PostList: React.FC<PostListProps> = ({ categoryId, onSelectPost }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPosts();
  }, [categoryId, page]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const url = new URL('http://localhost:3001/api/posts');
      if (categoryId) url.searchParams.append('category', categoryId.toString());
      url.searchParams.append('page', page.toString());
      
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

  const handlePinPost = async (postId: number, pinned: boolean) => {
    if (!user || user.role !== 'admin') return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/posts/${postId}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ pinned }),
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Error pinning post:', error);
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
    <div className="space-y-4">
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Chưa có bài viết nào trong danh mục này</p>
        </div>
      ) : (
        posts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectPost(post)}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {post.pinned && (
                      <Pin size={16} className="text-red-500" />
                    )}
                    <span 
                      className="px-2 py-1 text-xs rounded-full text-white font-medium"
                      style={{ backgroundColor: post.category_color }}
                    >
                      {post.category_name}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-green-600 transition-colors">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {post.content.substring(0, 200)}...
                  </p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <User size={14} />
                      <span>{post.username}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock size={14} />
                      <span>
                        {formatDistanceToNow(new Date(post.created_at), { 
                          addSuffix: true, 
                          locale: vi 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye size={14} />
                      <span>{post.views}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageSquare size={14} />
                      <span>{post.comment_count}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Heart size={14} />
                      <span>{post.reaction_count}</span>
                    </div>
                  </div>
                </div>
                
                {user && user.role === 'admin' && (
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePinPost(post.id, !post.pinned);
                      }}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        post.pinned 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {post.pinned ? 'Bỏ ghim' : 'Ghim'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PostList;