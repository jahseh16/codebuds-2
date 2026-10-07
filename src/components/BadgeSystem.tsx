import { Shield, Code, Star, Zap, Crown, Award } from 'lucide-react'

interface Badge {
  label: string
  icon: typeof Shield
  color: string
  glow: string
}

const ROLE_BADGES: Badge[] = [
  { label: 'VIP', icon: Crown, color: 'text-[#fbbf24] border-[#fbbf24]/30 bg-[#fbbf24]/10', glow: 'shadow-[0_0_8px_rgba(251,191,36,0.15)]' },
  { label: 'LEAD DEV', icon: Shield, color: 'text-[#7c3aed] border-[#7c3aed]/30 bg-[#7c3aed]/10', glow: 'shadow-[0_0_8px_rgba(124,58,237,0.15)]' },
  { label: 'MENTOR', icon: Award, color: 'text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10', glow: 'shadow-[0_0_8px_rgba(34,197,94,0.15)]' },
  { label: 'PIONEER', icon: Star, color: 'text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.15)]' },
]

const SKILL_COLORS: Record<string, string> = {
  react: 'text-[#61dafb] border-[#61dafb]/30 bg-[#61dafb]/10',
  typescript: 'text-[#3178c6] border-[#3178c6]/30 bg-[#3178c6]/10',
  javascript: 'text-[#f7df1e] border-[#f7df1e]/30 bg-[#f7df1e]/10',
  node: 'text-[#68a063] border-[#68a063]/30 bg-[#68a063]/10',
  'node.js': 'text-[#68a063] border-[#68a063]/30 bg-[#68a063]/10',
  python: 'text-[#3776ab] border-[#3776ab]/30 bg-[#3776ab]/10',
  vue: 'text-[#42b883] border-[#42b883]/30 bg-[#42b883]/10',
  angular: 'text-[#dd0031] border-[#dd0031]/30 bg-[#dd0031]/10',
  docker: 'text-[#2496ed] border-[#2496ed]/30 bg-[#2496ed]/10',
  aws: 'text-[#ff9900] border-[#ff9900]/30 bg-[#ff9900]/10',
  postgresql: 'text-[#336791] border-[#336791]/30 bg-[#336791]/10',
  postgres: 'text-[#336791] border-[#336791]/30 bg-[#336791]/10',
  mongodb: 'text-[#47a248] border-[#47a248]/30 bg-[#47a248]/10',
  nextjs: 'text-white border-white/30 bg-white/10',
  'next.js': 'text-white border-white/30 bg-white/10',
  tailwind: 'text-[#38bdf8] border-[#38bdf8]/30 bg-[#38bdf8]/10',
  graphql: 'text-[#e535ab] border-[#e535ab]/30 bg-[#e535ab]/10',
  rust: 'text-[#dea584] border-[#dea584]/30 bg-[#dea584]/10',
  go: 'text-[#00add8] border-[#00add8]/30 bg-[#00add8]/10',
  java: 'text-[#ed8b00] border-[#ed8b00]/30 bg-[#ed8b00]/10',
  php: 'text-[#777bb4] border-[#777bb4]/30 bg-[#777bb4]/10',
  ruby: 'text-[#cc342d] border-[#cc342d]/30 bg-[#cc342d]/10',
}

function getSkillColor(skill: string): string {
  const lower = skill.toLowerCase()
  return SKILL_COLORS[lower] ?? 'text-[#a1a1aa] border-[#27272a] bg-[#18181b]'
}

interface BadgeSystemProps {
  skills: string[]
  memberSince?: string
  showRoles?: boolean
}

export function BadgeSystem({ skills, memberSince, showRoles = true }: BadgeSystemProps) {
  // Derive role badges from member duration or skills count
  const derivedRoles: Badge[] = []
  if (memberSince) {
    const months = (Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (months > 6) derivedRoles.push(ROLE_BADGES[3]) // PIONEER
    if (months > 3) derivedRoles.push(ROLE_BADGES[1]) // LEAD DEV
  }
  if (skills.length >= 5) derivedRoles.push(ROLE_BADGES[0]) // VIP
  if (skills.length >= 3) derivedRoles.push(ROLE_BADGES[2]) // MENTOR

  const topSkills = skills.slice(0, 8)

  return (
    <div className="space-y-3">
      {/* Role badges */}
      {showRoles && derivedRoles.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#52525b]">Roles</p>
          <div className="flex flex-wrap gap-1.5">
            {derivedRoles.map((badge) => {
              const Icon = badge.icon
              return (
                <span
                  key={badge.label}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.color} ${badge.glow}`}
                >
                  <Icon className="h-3 w-3" />
                  {badge.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Skill badges */}
      {topSkills.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#52525b]">Stack</p>
          <div className="flex flex-wrap gap-1.5">
            {topSkills.map((skill) => (
              <span
                key={skill}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getSkillColor(skill)}`}
              >
                <Code className="h-2.5 w-2.5" />
                {skill}
              </span>
            ))}
            {skills.length > 8 && (
              <span className="inline-flex items-center rounded-md border border-[#27272a] bg-[#18181b] px-2 py-1 text-[10px] font-bold text-[#52525b]">
                +{skills.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-[#52525b]">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-[#7c3aed]" />
          {skills.length} skills
        </span>
        {memberSince && (
          <span>
            Member since {new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}
