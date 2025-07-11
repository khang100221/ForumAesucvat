export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'moderator' | 'uploader';
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  minecraft_username?: string;
  bio?: string;
  post_count: number;
  reputation: number;
  banned: boolean;
  ban_reason?: string;
  join_date: string;
  last_active: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  parent_id?: number;
  sort_order: number;
  is_download_category: boolean;
  created_at: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  user_id: number;
  category_id: number;
  pinned: boolean;
  locked: boolean;
  views: number;
  attachments?: string[];
  is_ticket: boolean;
  ticket_status: 'open' | 'closed' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  solved: boolean;
  created_at: string;
  updated_at: string;
  username: string;
  avatar?: string;
  role: string;
  minecraft_username?: string;
  category_name: string;
  category_color: string;
  comment_count: number;
  reaction_count: number;
  comments?: Comment[];
  reactions?: Reaction[];
}

export interface Comment {
  id: number;
  content: string;
  user_id: number;
  post_id: number;
  parent_id?: number;
  hidden: boolean;
  created_at: string;
  username: string;
  avatar?: string;
  role: string;
  minecraft_username?: string;
}

export interface Reaction {
  id: number;
  user_id: number;
  post_id?: number;
  comment_id?: number;
  emoji: string;
  created_at: string;
  username: string;
}

export interface Download {
  id: number;
  name: string;
  description: string;
  file_path: string;
  file_size: number;
  category: 'mods' | 'packs' | 'shaders' | 'configs' | 'modpacks';
  user_id: number;
  downloads: number;
  version: string;
  minecraft_version: string;
  featured: boolean;
  approved: boolean;
  tags: string;
  screenshots?: string[];
  created_at: string;
  username: string;
  minecraft_username?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_id?: number;
  created_at: string;
}

export interface Server {
  id: number;
  name: string;
  description: string;
  ip: string;
  port: number;
  version: string;
  type: string;
  online_players: number;
  max_players: number;
  status: 'online' | 'offline' | 'maintenance';
  website?: string;
  discord?: string;
  created_at: string;
}

export interface Stats {
  users: number;
  posts: number;
  downloads: number;
  online: number;
}