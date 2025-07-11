import React, { useState, useEffect } from 'react';
import { X, Upload, Image, File, AlertCircle, CheckCircle } from 'lucide-react';
import { Category } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface CreatePostProps {
  onClose: () => void;
  onSuccess: () => void;
  isTicket?: boolean;
}

const CreatePost: React.FC<CreatePostProps> = ({ onClose, onSuccess, isTicket = false }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priority, setPriority] = useState('normal');
  const [categories, setCategories] = useState<Category[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.filter((cat: Category) => !cat.is_download_category));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !categoryId || !user) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('category_id', categoryId.toString());
      formData.append('is_ticket', isTicket ? '1' : '0');
      formData.append('priority', priority);
      
      attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await fetch('http://localhost:3001/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('aesucvat_token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Không thể tạo bài viết');
      }
    } catch (error) {
      setError('Có lỗi xảy ra khi tạo bài viết');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'normal':
        return 'bg-gray-100 text-gray-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${isTicket ? 'from-orange-600 to-orange-700' : 'from-green-600 to-green-700'} p-6 rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {isTicket ? 'Tạo Ticket Hỗ Trợ' : 'Tạo Bài Viết Mới'}
            </h2>
            <button
              onClick={onClose}
              className={`p-2 hover:${isTicket ? 'bg-orange-500' : 'bg-green-500'} rounded-lg transition-colors`}
            >
              <X size={24} className="text-white" />
            </button>
          </div>
          <p className="text-white text-opacity-90 mt-2">
            {isTicket ? 'Mô tả chi tiết vấn đề của bạn để được hỗ trợ nhanh chóng' : 'Chia sẻ kiến thức và kinh nghiệm với cộng đồng'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
              <AlertCircle size={16} className="mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tiêu đề *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder={isTicket ? 'Mô tả ngắn gọn vấn đề của bạn' : 'Nhập tiêu đề bài viết'}
                required
              />
            </div>

            {/* Category and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Danh mục *
                </label>
                <select
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {isTicket && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="low">Thấp</option>
                    <option value="normal">Bình thường</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getPriorityColor(priority)}`}>
                      {priority === 'low' && 'Thấp'}
                      {priority === 'normal' && 'Bình thường'}
                      {priority === 'high' && 'Cao'}
                      {priority === 'urgent' && 'Khẩn cấp'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nội dung *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder={isTicket ? 'Mô tả chi tiết vấn đề: các bước tái hiện, thông báo lỗi, môi trường (OS, Java version, mods...)' : 'Viết nội dung bài viết của bạn...'}
                required
              />
            </div>

            {/* File Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tệp đính kèm
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-green-500 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".png,.jpg,.jpeg,.gif,.zip,.jar,.txt,.log,.json,.cfg"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Upload size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    Kéo thả tệp vào đây hoặc click để chọn
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Hỗ trợ: PNG, JPG, GIF, ZIP, JAR, TXT, LOG, JSON, CFG (tối đa 100MB)
                  </span>
                </label>
              </div>
              
              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Tệp đã chọn:</p>
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                      <File size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isTicket ? 'bg-orange-600' : 'bg-green-600'
                }`}
              >
                {loading ? 'Đang tạo...' : (isTicket ? 'Tạo Ticket' : 'Đăng Bài')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;