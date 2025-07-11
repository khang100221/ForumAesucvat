import React, { useState, useEffect } from 'react';
import { Server, Users, Globe, MessageCircle, Copy, ExternalLink } from 'lucide-react';
import { Server as ServerType } from '../../types';

const ServersPage: React.FC = () => {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/servers');
      if (response.ok) {
        const data = await response.json();
        setServers(data);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyServerIP = (ip: string, port: number) => {
    const fullIP = port === 25565 ? ip : `${ip}:${port}`;
    navigator.clipboard.writeText(fullIP);
    // TODO: Show toast notification
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'survival':
        return 'bg-green-100 text-green-800';
      case 'creative':
        return 'bg-blue-100 text-blue-800';
      case 'skyblock':
        return 'bg-purple-100 text-purple-800';
      case 'pvp':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Servers Minecraft</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Server size={16} />
            <span>{servers.length} servers</span>
          </div>
        </div>
        <p className="text-gray-600">
          Khám phá các server Minecraft tuyệt vời của cộng đồng AESUCVAT
        </p>
      </div>

      {/* Servers Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12">
          <Server size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Chưa có server nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((server) => (
            <div key={server.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(server.status)}`}>
                        {server.status === 'online' && '🟢 Online'}
                        {server.status === 'offline' && '🔴 Offline'}
                        {server.status === 'maintenance' && '🟡 Bảo trì'}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getTypeColor(server.type)}`}>
                        {server.type.charAt(0).toUpperCase() + server.type.slice(1)}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{server.name}</h3>
                    <p className="text-gray-600 mb-4">{server.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Players</div>
                    <div className="text-lg font-bold text-indigo-600">
                      {server.online_players}/{server.max_players}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Server IP */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-600">Server IP</div>
                        <div className="font-mono text-lg font-medium text-gray-900">
                          {server.ip}{server.port !== 25565 && `:${server.port}`}
                        </div>
                      </div>
                      <button
                        onClick={() => copyServerIP(server.ip, server.port)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Copy IP"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Server Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Version</div>
                      <div className="font-medium">{server.version}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Type</div>
                      <div className="font-medium capitalize">{server.type}</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Player Count</span>
                      <span className="font-medium">{Math.round((server.online_players / server.max_players) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(server.online_players / server.max_players) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    <button className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2">
                      <Users size={16} />
                      <span>Tham gia</span>
                    </button>
                    {server.website && (
                      <button className="px-4 py-2 text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                        <ExternalLink size={16} />
                      </button>
                    )}
                    {server.discord && (
                      <button className="px-4 py-2 text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServersPage;