/*
# CodeBuds - Complete Database Schema

Creates all tables for the CodeBuds developer social network.

## Tables Created
1. profiles - User profiles (username, full_name, bio, avatar, skills, location, links, open_to status)
2. posts - Community feed posts with categories (general, mentorship, project, team)
3. likes - Post likes (one per user per post)
4. projects - User showcase projects with tech stack and stars
5. buddies - Developer connections (follower/following relationship)
6. mentorships - Mentorship requests between users
7. notifications - User notifications (buddy requests, likes, mentorship updates)

## Security
- RLS enabled on all tables
- Authenticated users can read all public content (profiles, posts, projects)
- Users can only write/update their own data
- Owner columns default to auth.uid() so inserts work without explicitly passing user_id
*/

-- ═══════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  bio text DEFAULT '',
  avatar_url text DEFAULT NULL,
  github_url text DEFAULT NULL,
  linkedin_url text DEFAULT NULL,
  location text DEFAULT '',
  skills text[] DEFAULT '{}',
  open_to text DEFAULT 'collaboration',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════════════════
-- POSTS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'mentorship', 'project', 'team')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all" ON posts;
CREATE POLICY "posts_select_all" ON posts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

-- ═══════════════════════════════════════════════════════
-- LIKES
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON likes;
CREATE POLICY "likes_select_all" ON likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own" ON likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own" ON likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- PROJECTS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  tech_stack text[] DEFAULT '{}',
  repo_url text DEFAULT NULL,
  live_url text DEFAULT NULL,
  image_url text DEFAULT NULL,
  stars integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_all" ON projects;
CREATE POLICY "projects_select_all" ON projects FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

-- ═══════════════════════════════════════════════════════
-- BUDDIES (connections)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS buddies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

ALTER TABLE buddies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buddies_select_all" ON buddies;
CREATE POLICY "buddies_select_all" ON buddies FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "buddies_insert_own" ON buddies;
CREATE POLICY "buddies_insert_own" ON buddies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "buddies_update_own" ON buddies;
CREATE POLICY "buddies_update_own" ON buddies FOR UPDATE
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id) WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "buddies_delete_own" ON buddies;
CREATE POLICY "buddies_delete_own" ON buddies FOR DELETE
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ═══════════════════════════════════════════════════════
-- MENTORSHIPS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mentorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentorships_select_all" ON mentorships;
CREATE POLICY "mentorships_select_all" ON mentorships FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "mentorships_insert_own" ON mentorships;
CREATE POLICY "mentorships_insert_own" ON mentorships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = mentee_id);

DROP POLICY IF EXISTS "mentorships_update_own" ON mentorships;
CREATE POLICY "mentorships_update_own" ON mentorships FOR UPDATE
  TO authenticated USING (auth.uid() = mentor_id OR auth.uid() = mentee_id) WITH CHECK (auth.uid() = mentor_id OR auth.uid() = mentee_id);

DROP POLICY IF EXISTS "mentorships_delete_own" ON mentorships;
CREATE POLICY "mentorships_delete_own" ON mentorships FOR DELETE
  TO authenticated USING (auth.uid() = mentor_id OR auth.uid() = mentee_id);

-- ═══════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('buddy_request', 'buddy_accepted', 'like', 'mentorship_request', 'mentorship_accepted')),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_projects_author_id ON projects(author_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddies_requester ON buddies(requester_id);
CREATE INDEX IF NOT EXISTS idx_buddies_addressee ON buddies(addressee_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);