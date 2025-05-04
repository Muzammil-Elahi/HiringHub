/**
 * Matching algorithm utility functions for calculating job match percentages
 */

/**
 * Calculate the match percentage between a resume text and job data
 * @param resumeText The extracted text from a job seeker's resume
 * @param job The job data object with description and skills
 * @returns A number between 0-100 representing match percentage
 */
export function calculateMatchPercentage(resumeText: string, job: any): number {
  if (!resumeText || !job) return 0;
  
  // Normalize all text to lowercase for comparison
  const normalizedResumeText = resumeText.toLowerCase();
  
  // Extract keywords from job description
  const jobDescription = job.description?.toLowerCase() || '';
  
  // Get job skills as an important source of keywords
  const jobSkills = job.job_skills?.map((skill: any) => 
    skill.skill_name?.toLowerCase() || ''
  ).filter(Boolean) || [];
  
  // Job title is important - add it to keywords
  const jobTitle = job.title?.toLowerCase() || '';
  
  // Create a combined set of keywords from job description
  // First, tokenize the description into words
  const descriptionWords = jobDescription
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)             // Split on whitespace
    .filter((word: string) => word.length > 3 && !commonWords.includes(word)); // Filter out common words and short words
  
  // Combine all keywords - skills are highest priority
  const allKeywords = [...new Set([
    ...jobSkills, 
    ...descriptionWords,
    ...jobTitle.split(/\s+/).filter((word: string) => word.length > 3 && !commonWords.includes(word))
  ])];
  
  // Count how many keywords appear in the resume
  let matchCount = 0;
  
  for (const keyword of allKeywords) {
    if (keyword && normalizedResumeText.includes(keyword)) {
      matchCount++;
      
      // Bonus points for skills matches - they're more important
      if (jobSkills.includes(keyword)) {
        matchCount += 0.5; // Add extra weight to skills matches
      }
    }
  }
  
  // Calculate percentage based on keywords found
  // Avoid division by zero
  if (allKeywords.length === 0) return 0;
  
  const matchPercentage = (matchCount / allKeywords.length) * 100;
  
  // Cap at 100%
  return Math.min(Math.round(matchPercentage), 100);
}

/**
 * Extract plain text from resume URL
 * This is a placeholder that assumes we're just parsing text content
 * In a production environment, you would need proper PDF/DOCX parsing
 */
export async function extractResumeText(resumeUrl: string): Promise<string> {
  if (!resumeUrl) return '';
  
  try {
    // In a real implementation, you would:
    // 1. Fetch the resume file 
    // 2. Parse it based on file type (PDF, DOCX, etc)
    // 3. Extract text content
    
    // For now, we'll use a placeholder - in production you would use:
    // - pdf.js for PDFs
    // - mammoth.js for DOCX files
    // - Or a backend service that handles extraction
    
    // Placeholder implementation for demo purposes
    // Replace this with actual implementation
    const response = await fetch(resumeUrl);
    
    // If it's plaintext, we can extract directly
    // If PDF/DOCX, this would need proper parsing
    const text = await response.text();
    return text;
    
  } catch (error) {
    console.error('Error extracting text from resume:', error);
    return '';
  }
}

// Common English words to ignore in matching (to reduce noise)
const commonWords = [
  'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
  'his', 'from', 'they', 'will', 'have', 'more', 'what', 'when', 'who', 'make',
  'like', 'time', 'just', 'know', 'take', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'than', 'then', 'look', 'only', 'come', 'over', 'think', 'also',
  'back', 'after', 'work', 'first', 'well', 'even', 'want', 'because', 'these', 'give',
  'most', 'very'
]; 