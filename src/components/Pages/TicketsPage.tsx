import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Post } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import PostDetail from '../Forum/PostDetail';
import CreatePost from '../Forum/CreatePost';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const TicketsPage: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Post[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Post | null>(null);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, [searchQuery, statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const url = new URL('http://localhost:3001/api/posts');
      url.searchParams.append('type', 'tickets');
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        let filteredTickets = data;
        
        if (statusFilter !== 'all') {
          filteredTickets = data.filter((ticket: Post) => 
            ticket.ticket_status === statusFilter
          );
        }
        
        setTickets(filteredTickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock size={16} />;
      case 'resolved':
        return <CheckCircle size={16} />;
      case 'closed':
        return <XCircle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  if (selectedTicket) {
    return (
      <PostDetail 
        postId={selectedTicket.id} 
        onBack={() => setSelectedTicket(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Tickets Hỗ trợ</h1>
          {user && (
            <button
              onClick={() => setShowCreateTicket(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Tạo ticket</span>
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
              placeholder="Tìm kiếm ticket..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="open">Đang mở</option>
            <option value="resolved">Đã giải quyết</option>
            <option value="closed">Đã đóng</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Không có ticket nào</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedTicket(ticket)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority === 'low' && 'Thấp'}
                        {ticket.priority === 'normal' && 'Bình thường'}
                        {ticket.priority === 'high' && 'Cao'}
                        {ticket.priority === 'urgent' && 'Khẩn cấp'}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium flex items-center space-x-1 ${getStatusColor(ticket.ticket_status)}`}>
                        {getStatusIcon(ticket.ticket_status)}
                        <span>
                          {ticket.ticket_status === 'open' && 'Đang mở'}
                          {ticket.ticket_status === 'resolved' && 'Đã giải quyết'}
                          {ticket.ticket_status === 'closed' && 'Đã đóng'}
                        </span>
                      </span>
                      {ticket.solved && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                          ✓ Đã giải quyết
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 transition-colors">
                      #{ticket.id} {ticket.title}
                    </h3>
                    
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {ticket.content.substring(0, 200)}...
                    </p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <span className="font-medium text-gray-700">{ticket.username}</span>
                        {ticket.role === 'admin' && <span className="text-yellow-500">👑</span>}
                        {ticket.role === 'moderator' && <span className="text-blue-500">🛡️</span>}
                      </div>
                      <span>
                        {formatDistanceToNow(new Date(ticket.created_at), { 
                          addSuffix: true, 
                          locale: vi 
                        })}
                      </span>
                      <span>{ticket.views} lượt xem</span>
                      <span>{ticket.comment_count} bình luận</span>
                    </div>
                  </div>
                  
                  <div className="ml-4 flex-shrink-0">
                    <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                      {ticket.avatar ? (
                        <img 
                          src={`http://localhost:3001/uploads/${ticket.avatar}`} 
                          alt={ticket.username} 
                          className="w-full h-full rounded-full object-cover" 
                        />
                      ) : (
                        <span className="text-white font-bold">
                          {ticket.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <CreatePost
          onClose={() => setShowCreateTicket(false)}
          onSuccess={fetchTickets}
          isTicket={true}
        />
      )}
    </div>
  );
};

export default TicketsPage;