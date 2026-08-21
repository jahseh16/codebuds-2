export interface Profile {
  id: string
  username: string
  full_name: string
  bio: string
  avatar_url: string | null
  github_url: string | null
  linkedin_url: string | null
  location: string
  skills: string[]
  open_to: string
  created_at: string
  updated_at: string
}

export type PostCategory = 'general' | 'mentorship' | 'project' | 'team'

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
  created_at: string
  author?: Profile
  likes?: Like[]
  like_count?: number
  liked_by_me?: boolean
  comment_count?: number
}

export interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface Project {
  id: string
  author_id: string
  title: string
  description: string
  tech_stack: string[]
  repo_url: string | null
  live_url: string | null
  image_url: string | null
  stars: number
  created_at: string
  author?: Profile
}

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
