'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  time: string;
  likes: number;
  likedBy: string[];
}

interface Post {
  id: string;
  author: string;
  avatar: string;
  time: string;
  title: string;
  content: string;
  likes: number;
  comments: number;
  tags: string[];
  likedBy: string[];
  commentList: Comment[];
}

const POSTS_STORAGE_KEY = 'wepower-community-posts';

const defaultPosts: Post[] = [
  {
    id: 'post-1',
    author: 'Nguyễn Văn A',
    avatar: 'N',
    time: '2 giờ trước',
    title: 'Chia sẻ kinh nghiệm học AI Marketing',
    content: 'Mình vừa hoàn thành khóa học AI Marketing và muốn chia sẻ một số insights với mọi người. Khóa học rất bổ ích, đặc biệt phần ứng dụng AI trong phân tích dữ liệu khách hàng...',
    likes: 45,
    comments: 2,
    tags: ['AI', 'Marketing', 'Tips'],
    likedBy: [],
    commentList: [
      { id: 'c1', author: 'Trần Thị B', avatar: 'T', content: 'Cảm ơn bạn chia sẻ! Mình cũng đang học khóa này, phần AI analysis rất hay.', time: '1 giờ trước', likes: 5, likedBy: [] },
      { id: 'c2', author: 'Lê Văn C', avatar: 'L', content: 'Bạn có thể chia sẻ thêm về phần prompt engineering trong marketing được không?', time: '30 phút trước', likes: 3, likedBy: [] },
    ],
  },
  {
    id: 'post-2',
    author: 'Trần Thị B',
    avatar: 'T',
    time: '5 giờ trước',
    title: 'Câu hỏi về Digital Marketing Fundamentals',
    content: 'Có bạn nào đang học khóa Digital Marketing Fundamentals không? Mình muốn hỏi về phần SEO, cụ thể là cách tối ưu on-page SEO cho website thương mại điện tử...',
    likes: 23,
    comments: 1,
    tags: ['Digital Marketing', 'Question'],
    likedBy: [],
    commentList: [
      { id: 'c3', author: 'Nguyễn Văn A', avatar: 'N', content: 'Mình đã hoàn thành phần SEO rồi. Key chính là tối ưu meta tags, heading structure và internal linking nhé!', time: '3 giờ trước', likes: 8, likedBy: [] },
    ],
  },
  {
    id: 'post-3',
    author: 'Lê Văn C',
    avatar: 'L',
    time: '1 ngày trước',
    title: 'Tổng hợp tài liệu học Content Creator hay',
    content: 'Mình đã tổng hợp một số tài liệu và tools hữu ích cho ai đang học Content Creator. Bao gồm các công cụ thiết kế, viết content, và phân tích hiệu quả nội dung...',
    likes: 67,
    comments: 2,
    tags: ['Content', 'Resources'],
    likedBy: [],
    commentList: [
      { id: 'c4', author: 'Nguyễn Văn A', avatar: 'N', content: 'Quá hữu ích! Saved lại để tham khảo.', time: '20 giờ trước', likes: 12, likedBy: [] },
      { id: 'c5', author: 'Trần Thị B', avatar: 'T', content: 'Bạn có recommend tool nào cho video editing không?', time: '18 giờ trước', likes: 4, likedBy: [] },
    ],
  },
];

function loadPosts(): Post[] {
  if (typeof window === 'undefined') return defaultPosts;
  try {
    const saved = localStorage.getItem(POSTS_STORAGE_KEY);
    if (saved) {
      const posts = JSON.parse(saved);
      if (posts.length > 0) {
        // Migrate old posts without commentList
        return posts.map((p: Post) => ({
          ...p,
          commentList: p.commentList || [],
        }));
      }
    }
  } catch { /* ignore */ }
  return defaultPosts;
}

function savePosts(posts: Post[]) {
  try { localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts)); } catch { /* ignore */ }
}

export default function Community() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'popular' | 'recent' | 'my-posts'>('popular');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPost, setNewPost] = useState('');
  const [newPostTags, setNewPostTags] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setPosts(loadPosts());
  }, []);

  const handlePostSubmit = () => {
    if (!newPost.trim() || !newPostTitle.trim()) {
      showToast('Vui lòng nhập tiêu đề và nội dung bài viết', 'error');
      return;
    }
    if (!user) {
      showToast('Vui lòng đăng nhập để đăng bài', 'error');
      return;
    }
    const tags = newPostTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const post: Post = {
      id: `post-${Date.now()}`,
      author: user.name,
      avatar: user.name.charAt(0).toUpperCase(),
      time: 'Vừa xong',
      title: newPostTitle,
      content: newPost,
      likes: 0,
      comments: 0,
      tags,
      likedBy: [],
      commentList: [],
    };
    const updated = [post, ...posts];
    setPosts(updated);
    savePosts(updated);
    setNewPost('');
    setNewPostTitle('');
    setNewPostTags('');
    showToast('Bài viết của bạn đã được đăng!', 'success');
  };

  const handleDeletePost = (postId: string) => {
    if (deleteConfirm !== postId) {
      setDeleteConfirm(postId);
      return;
    }
    const updated = posts.filter(p => p.id !== postId);
    setPosts(updated);
    savePosts(updated);
    setDeleteConfirm(null);
    showToast('Đã xóa bài viết', 'success');
  };

  const handleLike = (postId: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thích bài viết', 'error');
      return;
    }
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      const alreadyLiked = p.likedBy.includes(user.email);
      return {
        ...p,
        likes: alreadyLiked ? p.likes - 1 : p.likes + 1,
        likedBy: alreadyLiked
          ? p.likedBy.filter(e => e !== user.email)
          : [...p.likedBy, user.email],
      };
    });
    setPosts(updated);
    savePosts(updated);
  };

  const handleAddComment = (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) {
      showToast('Vui lòng nhập nội dung bình luận', 'error');
      return;
    }
    if (!user) {
      showToast('Vui lòng đăng nhập để bình luận', 'error');
      return;
    }
    const comment: Comment = {
      id: `comment-${Date.now()}`,
      author: user.name,
      avatar: user.name.charAt(0).toUpperCase(),
      content,
      time: 'Vừa xong',
      likes: 0,
      likedBy: [],
    };
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: p.comments + 1,
        commentList: [...p.commentList, comment],
      };
    });
    setPosts(updated);
    savePosts(updated);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    showToast('Đã thêm bình luận!', 'success');
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thích bình luận', 'error');
      return;
    }
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        commentList: p.commentList.map(c => {
          if (c.id !== commentId) return c;
          const alreadyLiked = c.likedBy.includes(user.email);
          return {
            ...c,
            likes: alreadyLiked ? c.likes - 1 : c.likes + 1,
            likedBy: alreadyLiked
              ? c.likedBy.filter(e => e !== user.email)
              : [...c.likedBy, user.email],
          };
        }),
      };
    });
    setPosts(updated);
    savePosts(updated);
  };

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  let filteredPosts = activeTab === 'popular'
    ? [...posts].sort((a, b) => b.likes - a.likes)
    : activeTab === 'recent'
      ? posts
      : posts.filter(p => user && p.author === user.name);

  if (selectedTag) {
    filteredPosts = filteredPosts.filter(p =>
      p.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
    );
  }

  // Collect all unique tags from posts
  const allTags = Array.from(new Set(posts.flatMap(p => p.tags))).slice(0, 8);
  const defaultTags = ['AI Marketing', 'Digital Marketing', 'Content Creator', 'SEO', 'Social Media', 'Data Analytics'];
  const displayTags = allTags.length > 0 ? allTags : defaultTags;

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Cộng đồng WEPOWER
          </h1>
          <p className="text-gray-400">
            Kết nối, chia sẻ kinh nghiệm và học hỏi cùng nhau
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Post */}
            {user ? (
              <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal to-gold flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <input
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      placeholder="Tiêu đề bài viết..."
                      className="w-full px-4 py-2 mb-2 bg-dark border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal text-sm font-semibold"
                    />
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="Bạn muốn chia sẻ điều gì?"
                      className="w-full px-4 py-3 bg-dark border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal resize-none"
                      rows={3}
                    />
                    <input
                      value={newPostTags}
                      onChange={(e) => setNewPostTags(e.target.value)}
                      placeholder="Tags (phân cách bằng dấu phẩy, VD: AI, Marketing)"
                      className="w-full px-4 py-2 mt-2 bg-dark border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal text-sm"
                    />
                    <div className="flex items-center justify-end mt-3">
                      <Button variant="primary" size="sm" onClick={handlePostSubmit}>
                        Đăng bài
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6 text-center">
                <p className="text-gray-400 mb-3">Đăng nhập để tham gia cộng đồng</p>
                <Link href="/login">
                  <Button variant="primary" size="sm">Đăng nhập</Button>
                </Link>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-white/10">
              {[
                { id: 'popular' as const, label: 'Phổ biến' },
                { id: 'recent' as const, label: 'Mới nhất' },
                { id: 'my-posts' as const, label: 'Bài của tôi' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 px-4 font-semibold transition-colors relative ${
                    activeTab === tab.id ? 'text-teal' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Active tag filter indicator */}
            {selectedTag && (
              <div className="flex items-center gap-2 p-3 bg-teal/10 border border-teal/20 rounded-lg">
                <span className="text-sm text-teal">Đang lọc theo tag:</span>
                <span className="px-2 py-0.5 bg-teal text-white text-xs rounded-full font-semibold">#{selectedTag}</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="ml-auto text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Posts List */}
            <div className="space-y-4">
              {filteredPosts.length > 0 ? filteredPosts.map((post) => (
                <div key={post.id} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6 hover:border-teal/30 transition-colors">
                  {/* Author Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-gold flex items-center justify-center text-white font-bold">
                      {post.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{post.author}</p>
                      <p className="text-sm text-gray-400">{post.time}</p>
                    </div>
                    {/* Delete button for own posts */}
                    {user && post.author === user.name && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          deleteConfirm === post.id
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'text-gray-500 hover:text-red-400'
                        }`}
                      >
                        {deleteConfirm === post.id ? 'Xác nhận xóa?' : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <h3
                    className="text-xl font-bold text-white mb-2 hover:text-teal transition-colors cursor-pointer"
                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                  >
                    {post.title}
                  </h3>

                  {/* Content */}
                  <p className={`text-gray-300 mb-4 whitespace-pre-wrap ${expandedPost === post.id ? '' : 'line-clamp-3'}`}>
                    {post.content}
                  </p>
                  {post.content.length > 150 && expandedPost !== post.id && (
                    <button
                      onClick={() => setExpandedPost(post.id)}
                      className="text-teal text-sm font-semibold hover:underline mb-4 block"
                    >
                      Xem thêm
                    </button>
                  )}

                  {/* Tags */}
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((tag, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            selectedTag === tag
                              ? 'bg-teal text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-teal/20 hover:text-teal'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-2 transition-colors ${
                        user && post.likedBy.includes(user.email)
                          ? 'text-teal'
                          : 'text-gray-400 hover:text-teal'
                      }`}
                    >
                      <svg className="w-5 h-5" fill={user && post.likedBy.includes(user.email) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span className="font-semibold">{post.likes}</span>
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center gap-2 transition-colors ${
                        showComments[post.id] ? 'text-gold' : 'text-gray-400 hover:text-gold'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span className="font-semibold">{post.commentList.length}</span>
                    </button>
                    <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors ml-auto">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {showComments[post.id] && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      {/* Comment List */}
                      {post.commentList.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {post.commentList.map((comment) => (
                            <div key={comment.id} className="flex gap-3 p-3 bg-dark rounded-lg">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal/70 to-gold/70 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {comment.avatar}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-white">{comment.author}</span>
                                  <span className="text-xs text-gray-500">{comment.time}</span>
                                </div>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                                <button
                                  onClick={() => handleLikeComment(post.id, comment.id)}
                                  className={`flex items-center gap-1 mt-2 text-xs transition-colors ${
                                    user && comment.likedBy.includes(user.email)
                                      ? 'text-teal'
                                      : 'text-gray-500 hover:text-teal'
                                  }`}
                                >
                                  <svg className="w-3.5 h-3.5" fill={user && comment.likedBy.includes(user.email) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                  {comment.likes > 0 && <span>{comment.likes}</span>}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment */}
                      {user ? (
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-gold flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <input
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                              placeholder="Viết bình luận..."
                              className="flex-1 px-3 py-2 bg-dark border border-white/[0.06] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal"
                            />
                            <button
                              onClick={() => handleAddComment(post.id)}
                              className="px-3 py-2 bg-teal hover:bg-teal/80 text-white rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center">
                          <Link href="/login" className="text-teal hover:underline">Đăng nhập</Link> để bình luận
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-12 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-400">Chưa có bài viết nào</p>
                  <p className="text-gray-500 text-sm mt-1">Hãy là người đầu tiên chia sẻ!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Community Stats */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6">
              <h3 className="font-bold text-white mb-4">Thống kê cộng đồng</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Thành viên</span>
                  <span className="font-bold text-gold">15,847</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Bài viết</span>
                  <span className="font-bold text-gold">{posts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Bình luận</span>
                  <span className="font-bold text-gold">{posts.reduce((s, p) => s + p.commentList.length, 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Lượt thích</span>
                  <span className="font-bold text-gold">{posts.reduce((s, p) => s + p.likes, 0)}</span>
                </div>
              </div>
            </div>

            {/* Popular Tags */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6">
              <h3 className="font-bold text-white mb-4">Chủ đề phổ biến</h3>
              <div className="flex flex-wrap gap-2">
                {displayTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedTag === tag
                        ? 'bg-teal text-white'
                        : 'bg-white/5 hover:bg-teal text-gray-400 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Top Contributors */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6">
              <h3 className="font-bold text-white mb-4">Người đóng góp hàng đầu</h3>
              <div className="space-y-3">
                {(() => {
                  const authorCounts: Record<string, { name: string; avatar: string; count: number }> = {};
                  posts.forEach(p => {
                    if (!authorCounts[p.author]) {
                      authorCounts[p.author] = { name: p.author, avatar: p.avatar, count: 0 };
                    }
                    authorCounts[p.author].count++;
                  });
                  return Object.values(authorCounts)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((contributor, index) => (
                      <div key={contributor.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-gold flex items-center justify-center text-white text-sm font-bold">
                          {contributor.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-semibold">{contributor.name}</p>
                          <p className="text-xs text-gray-400">{contributor.count} bài viết</p>
                        </div>
                        <span className="text-gold font-bold text-lg">#{index + 1}</span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
