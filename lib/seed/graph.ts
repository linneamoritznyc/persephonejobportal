/**
 * Kompetensgrafen extension for Linnea's region of the occupation graph.
 * The crosstrees seed (22 occupations) covers care, industry and logistics;
 * these rows add the occupations near her profile, with substitutability
 * scores on the AF scale (25/50/75) and the skills each one requires.
 */
export const SEED_OCCUPATIONS = ["web_developer", "digital_marketing", "content_moderator", "product_manager", "video_editor", "data_analyst", "admissions_officer", "visual_artist"];

export const OCCUPATIONS: { id: string; name: string; alt: string[]; gift?: string; skills: { s: string; imp?: "required" | "preferred" }[] }[] = [
  // Seeds
  { id: "web_developer", name: "Web developer", alt: ["Webbutvecklare", "Fullstackutvecklare", "Full stack developer"], gift: "craftsmanship", skills: [{ s: "TypeScript" }, { s: "React" }, { s: "Next.js" }, { s: "SQL" }, { s: "REST APIs" }, { s: "Git", imp: "preferred" }] },
  { id: "digital_marketing", name: "Digital marketing specialist", alt: ["Digital marknadsförare", "Performance marketer"], gift: "stewardship", skills: [{ s: "Google Ads" }, { s: "GA4" }, { s: "Google Tag Manager" }, { s: "Copywriting", imp: "preferred" }, { s: "Social media strategy", imp: "preferred" }] },
  { id: "content_moderator", name: "Content moderator", alt: ["Innehållsmoderator", "Trust & Safety analyst"], gift: "discernment", skills: [{ s: "Content moderation" }, { s: "Policy enforcement" }, { s: "Quality assurance" }, { s: "Trust & Safety" }] },
  { id: "product_manager", name: "Product manager", alt: ["Produktchef", "Produktägare", "Product owner"], gift: "vision", skills: [{ s: "Stakeholder management" }, { s: "Project management" }, { s: "SQL", imp: "preferred" }, { s: "LLM integration", imp: "preferred" }] },
  { id: "video_editor", name: "Video editor", alt: ["Videoredigerare", "Videoproducent"], gift: "craftsmanship", skills: [{ s: "Video editing" }, { s: "Remotion", imp: "preferred" }, { s: "Copywriting", imp: "preferred" }] },
  { id: "data_analyst", name: "Data analyst", alt: ["Dataanalytiker", "Analytiker"], gift: "stewardship", skills: [{ s: "SQL" }, { s: "Python" }, { s: "BigQuery" }, { s: "Looker", imp: "preferred" }] },
  { id: "admissions_officer", name: "Recruiter / admissions officer", alt: ["Rekryterare", "Antagningshandläggare"], gift: "encouragement", skills: [{ s: "Customer onboarding" }, { s: "Stakeholder management" }, { s: "Workshops and training", imp: "preferred" }] },
  { id: "visual_artist", name: "Visual artist", alt: ["Bildkonstnär", "Konstnär"], gift: "vision", skills: [{ s: "Video editing", imp: "preferred" }, { s: "Copywriting", imp: "preferred" }] },
  // Discoveries
  { id: "solutions_engineer", name: "Solutions Engineer", alt: ["Lösningsarkitekt", "Sales engineer", "Pre-sales engineer"], gift: "interpretation", skills: [{ s: "REST APIs" }, { s: "Customer onboarding" }, { s: "Stakeholder management" }, { s: "LLM integration" }, { s: "SQL", imp: "preferred" }, { s: "Python", imp: "preferred" }, { s: "Workshops and training", imp: "preferred" }] },
  { id: "deployment_strategist", name: "Deployment Strategist", alt: ["AI deployment strategist", "Implementation lead"], gift: "interpretation", skills: [{ s: "Customer onboarding" }, { s: "Project management" }, { s: "LLM integration" }, { s: "Stakeholder management" }, { s: "Voice agents", imp: "preferred" }] },
  { id: "forward_deployed_engineer", name: "Forward Deployed Engineer", alt: ["FDE", "Customer-embedded engineer"], gift: "craftsmanship", skills: [{ s: "Python" }, { s: "TypeScript" }, { s: "LLM integration" }, { s: "REST APIs" }, { s: "Customer onboarding" }, { s: "Voice agents", imp: "preferred" }] },
  { id: "marketing_technologist", name: "Marketing Technologist", alt: ["Martech specialist", "Marknadsteknolog"], gift: "stewardship", skills: [{ s: "Google Tag Manager" }, { s: "GA4" }, { s: "BigQuery" }, { s: "Webhooks" }, { s: "SQL" }, { s: "AI automation", imp: "preferred" }] },
  { id: "ad_tech_specialist", name: "Ad Tech Specialist", alt: ["Annonsteknisk specialist", "Ad operations specialist"], gift: "stewardship", skills: [{ s: "Google Ads" }, { s: "Smart Bidding" }, { s: "Offline conversion import" }, { s: "GTM Server" }, { s: "SQL", imp: "preferred" }] },
  { id: "creative_technologist", name: "Creative Technologist", alt: ["Kreativ teknolog"], gift: "craftsmanship", skills: [{ s: "Remotion" }, { s: "TypeScript" }, { s: "Video editing" }, { s: "AI content pipelines" }, { s: "React", imp: "preferred" }] },
  { id: "customer_success_engineer", name: "Customer Success Engineer", alt: ["Technical customer success manager", "Technical account manager"], gift: "encouragement", skills: [{ s: "Customer onboarding" }, { s: "REST APIs" }, { s: "SQL" }, { s: "Workshops and training", imp: "preferred" }] },
  { id: "policy_analyst", name: "Policy Analyst (Trust & Safety)", alt: ["Content policy analyst", "Integrity analyst"], gift: "discernment", skills: [{ s: "Policy enforcement" }, { s: "Trust & Safety" }, { s: "Quality assurance" }, { s: "SQL", imp: "preferred" }] },
  { id: "learning_experience_designer", name: "Learning Experience Designer", alt: ["Utbildningsdesigner", "Instructional designer"], gift: "teaching", skills: [{ s: "Workshops and training" }, { s: "Video editing" }, { s: "Copywriting" }, { s: "AI content pipelines", imp: "preferred" }] },
  { id: "program_manager_impact", name: "Program Manager (impact)", alt: ["Programansvarig", "Impact program manager"], gift: "giving", skills: [{ s: "Project management" }, { s: "Grant writing" }, { s: "Stakeholder management" }] },
  { id: "ai_automation_engineer", name: "AI Automation Engineer", alt: ["AI-utvecklare", "Applied AI engineer", "AI engineer"], gift: "mercy", skills: [{ s: "AI automation" }, { s: "LLM integration" }, { s: "Python" }, { s: "TypeScript" }, { s: "Webhooks" }, { s: "Claude API", imp: "preferred" }] },
  { id: "ai_consultant", name: "AI Consultant", alt: ["AI-konsult", "Data and AI consultant"], gift: "interpretation", skills: [{ s: "LLM integration" }, { s: "Stakeholder management" }, { s: "Python" }, { s: "Workshops and training" }, { s: "Project management", imp: "preferred" }] },
  { id: "growth_pm", name: "Growth Product Manager", alt: ["Tillväxtansvarig produkt"], gift: "vision", skills: [{ s: "GA4" }, { s: "SQL" }, { s: "Stakeholder management" }, { s: "Project management" }] },
];

/** Substitutability edges (AF scale: 75 high, 50 medium, 25 low). */
export const EDGES: [string, string, 25 | 50 | 75][] = [
  ["web_developer", "forward_deployed_engineer", 75], ["web_developer", "ai_automation_engineer", 75], ["web_developer", "creative_technologist", 50], ["web_developer", "solutions_engineer", 50], ["web_developer", "customer_success_engineer", 50],
  ["digital_marketing", "marketing_technologist", 75], ["digital_marketing", "ad_tech_specialist", 75], ["digital_marketing", "growth_pm", 50],
  ["content_moderator", "policy_analyst", 75], ["content_moderator", "learning_experience_designer", 25],
  ["product_manager", "growth_pm", 75], ["product_manager", "deployment_strategist", 50], ["product_manager", "program_manager_impact", 50], ["product_manager", "solutions_engineer", 50],
  ["video_editor", "creative_technologist", 75], ["video_editor", "learning_experience_designer", 50],
  ["data_analyst", "marketing_technologist", 50], ["data_analyst", "ad_tech_specialist", 50], ["data_analyst", "ai_consultant", 50], ["data_analyst", "policy_analyst", 25],
  ["admissions_officer", "customer_success_engineer", 50], ["admissions_officer", "deployment_strategist", 50], ["admissions_officer", "program_manager_impact", 50], ["admissions_officer", "learning_experience_designer", 50],
  ["visual_artist", "creative_technologist", 50],
  ["solutions_engineer", "forward_deployed_engineer", 75], ["solutions_engineer", "deployment_strategist", 75], ["solutions_engineer", "customer_success_engineer", 75], ["solutions_engineer", "ai_consultant", 50],
  ["ai_automation_engineer", "forward_deployed_engineer", 75], ["ai_automation_engineer", "ai_consultant", 50],
  ["marketing_technologist", "ad_tech_specialist", 75],
  // Bridges into the crosstrees seed graph
  ["web_developer", "35a28d4b-5a50-4ab9-9ac8-6a5f5c43d5b6", 75], ["data_analyst", "c3e67890-d4f7-11ee-a506-0242ac120002", 50],
];
