export interface SkillDetail {
  name: string;
  isPresent: boolean;
  suggestedBullet?: string;
  draftedBullet?: string;
  isDrafting?: boolean;
  importance: 'Required' | 'Preferred';
}

export interface SkillCategory {
  title: string;
  skills: SkillDetail[];
}

export interface RadarMetrics {
  technical: number;
  leadership: number;
  experience: number;
  domain: number;
}

export interface AnalysisDetails {
  hard_skills_match: string[];
  soft_skills_match: string[];
  missing_skills: string[];
  experience_gap: string;
}

export interface SkillContext {
  years?: string;
  proficiency?: string;
  notes?: string;
}

export interface AnalysisResult {
  match_score: number;
  radar_metrics: RadarMetrics;
  analysis: AnalysisDetails;
  recommendations: string[];
  improvement_plan: string[];
  // Compatibility fields for the Radar Chart and existing UI
  radarData?: { subject: string; score: number }[];
  skill_context?: Record<string, SkillContext>;
}
