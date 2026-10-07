export interface Profile {
  id: string
  username: string
  full_name: string
  bio: string
  avatar_url: string | null
  banner_url?: string | null
  github_url: string | null
  linkedin_url: string | null
  location: string
  skills: string[]
  open_to: string
  // Matching fields
  age_range: string
  city: string
  interests: string[]
  looking_for: string[]
  availability: string
  visibility: string
  age_verified: boolean
  last_active: string
  // Location fields (optional)
  country?: string | null
  country_code?: string | null
  region?: string | null
  timezone?: string | null
  // Stats
  followers_count?: number
  following_count?: number
  posts_count?: number
  projects_count?: number
  // Follow state
  is_following?: boolean
  created_at: string
  updated_at: string
}



export interface LinkPreview {
  type?: 'youtube' | 'tiktok' | 'twitter' | 'spotify' | 'link'
  url?: string
  title?: string | null
  description?: string | null
  image?: string | null
  siteName?: string | null
  videoId?: string
  embedUrl?: string
  thumbnailUrl?: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  user?: Profile
}

export interface Post {
  id: string
  author_id: string
  content: string
  category: PostCategory
  link_preview?: LinkPreview | null
  created_at: string
  author?: Profile
  likes?: Like[]
  like_count?: number
  liked_by_me?: boolean
  comment_count?: number
  view_count?: number
  user_has_saved?: boolean
}

export interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export type ProjectStatus = 'idea' | 'in_progress' | 'beta' | 'completed'

export interface Project {
  id: string
  author_id: string
  title: string
  description: string
  status: ProjectStatus
  tech_stack: string[]
  looking_for: string[]
  repo_url: string | null
  live_url: string | null
  file_url: string | null
  image_url: string | null
  stars: number
  save_count: number
  created_at: string
  updated_at: string
  author?: Profile
  user_has_saved?: boolean
}

export type PostCategory = 'general' | 'mentorship' | 'project_update' | 'looking_for_collaborator' | 'code_snippet' | 'need_help' | 'team'

export type BuddyStatus = 'pending' | 'accepted' | 'declined'

export interface Buddy {
  id: string
  requester_id: string
  addressee_id: string
  status: BuddyStatus
  created_at: string
  requester?: Profile
  addressee?: Profile
}

export type MentorshipStatus = 'pending' | 'accepted' | 'declined' | 'completed'

export interface Mentorship {
  id: string
  mentor_id: string
  mentee_id: string
  topic: string
  message: string
  status: MentorshipStatus
  created_at: string
  mentor?: Profile
  mentee?: Profile
}

export type NotificationType =
  | 'buddy_request'
  | 'buddy_accepted'
  | 'like'
  | 'mentorship_request'
  | 'mentorship_accepted'

export interface AppNotification {
  id: string
  user_id: string
  actor_id: string | null
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
  actor?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  read: boolean
  created_at: string
  sender?: Profile
}

export interface Conversation {
  id: string
  user_a_id: string
  user_b_id: string
  created_at: string
  updated_at: string
  userA?: Profile
  userB?: Profile
  messages?: Message[]
  unread_count?: number
}

// ═══════════════════════════════════════════════════════
// MATCHING SYSTEM
// ═══════════════════════════════════════════════════════

export type VibeStatus = 'pending' | 'accepted' | 'declined'

export interface Vibe {
  id: string
  sender_id: string
  receiver_id: string
  status: VibeStatus
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export interface Match {
  id: string
  user_a_id: string
  user_b_id: string
  created_at: string
  userA?: Profile
  userB?: Profile
}

export interface Block {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'underage' | 'other'

export interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: ReportReason
  description: string
  status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
  follower?: Profile
  following?: Profile
}

// Saved item wrapper for paginated saved endpoint
export interface SavedItem {
  type: 'post' | 'project' | 'user'
  data: Post | Project | Profile
  saved_at: string
}

export type LookingForOption = 'study_buddy' | 'project_collab' | 'gaming_buddy' | 'mentor' | 'dating'

export const LOOKING_FOR_OPTIONS: { value: LookingForOption; label: string }[] = [
  { value: 'study_buddy', label: 'Study Buddy' },
  { value: 'project_collab', label: 'Project Collaborator' },
  { value: 'gaming_buddy', label: 'Gaming Buddy' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'dating', label: 'Dating' },
]

export const INTEREST_OPTIONS: string[] = [
  'Coding', 'Design', 'Gaming', 'Music', 'Reading', 'Fitness',
  'Photography', 'Travel', 'Cooking', 'Art', 'Science', 'Math',
  'AI/ML', 'Web Dev', 'Mobile Dev', 'DevOps', 'Security', 'Data',
]

export const AGE_RANGE_OPTIONS: string[] = ['18-24', '25-34', '35-44', '45+']

export const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'evenings', label: 'Evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'flexible', label: 'Flexible' },
]
