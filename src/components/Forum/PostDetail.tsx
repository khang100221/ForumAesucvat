import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, Heart, MessageSquare, Edit, Trash2, Pin, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Post, Comment } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface PostDetailProps {
  postId: number;
  onBack: () => void;
}

const PostDetail: React.FC<PostDetailProps> = ({ postId, onBack }) => {
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/posts/${postId}`);
      if (response.ok) {
        const data = await response.json();
        setPost(data);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      const response = await fetch('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          content: newComment,
          post_id: postId,
          parent_id: replyTo,
        }),
      });

      if (response.ok) {
        setNewComment('');
        setReplyTo(null);
        fetchPost();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;

    try {
      const response = await fetch('http://localhost:3001/api/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          emoji,
          post_id: postId,
        }),
      });

      if (response.ok) {
        fetchPost();
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không tìm thấy bài viết</p>
      </div>
    );
  }

  const reactionCounts = post.reactions?.reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Quay lại</span>
        </button>
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-600 hover:text-gray-900 transition-colors">
            <Share2 size={20} />
          </button>
          {user && (user.id === post.user_id || user.role === 'admin') && (
            <>
              <button className="p-2 text-gray-600 hover:text-gray-900 transition-colors">
                <Edit size={20} />
              </button>
              <button className="p-2 text-red-600 hover:text-red-700 transition-colors">
                <Trash2 size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
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
              
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {post.title}
              </h1>
              
              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {post.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>{post.username}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye size={14} />
                  <span>{post.views}</span>
                </div>
                <span>
                  {formatDistanceToNow(new Date(post.created_at), { 
                    addSuffix: true, 
                    locale: vi 
                  })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="prose max-w-none mb-6">
            {post.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4 text-gray-700 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Tệp đính kèm</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {post.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold">📎</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{attachment}</div>
                      <div className="text-sm text-gray-500">Tệp đính kèm</div>
                    </div>
                    <button className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Tải xuống
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reactions */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors ${
                      post.reactions?.some(r => r.emoji === emoji && r.user_id === user?.id)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{emoji}</span>
                    {reactionCounts[emoji] && (
                      <span className="text-sm font-medium">{reactionCounts[emoji]}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{post.comment_count} bình luận</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Bình luận</h3>
          
          {/* Add Comment Form */}
          {user && (
            <form onSubmit={handleAddComment} className="mb-6">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Viết bình luận..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      {replyTo && (
                        <button
                          type="button"
                          onClick={() => setReplyTo(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Hủy trả lời
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Gửi bình luận
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {post.comments?.map((comment) => (
              <div key={comment.id} className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {comment.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-gray-900">{comment.username}</span>
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(comment.created_at), { 
                          addSuffix: true, 
                          locale: vi 
                        })}
                      </span>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                  {user && (
                    <div className="flex items-center space-x-4 mt-2">
                      <button
                        onClick={() => setReplyTo(comment.id)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Trả lời
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;