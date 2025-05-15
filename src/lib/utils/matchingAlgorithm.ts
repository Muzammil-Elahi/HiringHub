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
  
  const jobDescription = job.description || '';
  const jobSkills = job.job_skills?.map((skill: any) => skill.skill_name || '').filter(Boolean) || [];
  const jobTitle = job.title || '';
  
  // Combine job details into a single text for comparison
  const jobText = `${jobTitle} ${jobDescription} ${jobSkills.join(' ')}`;
  
  return calculateSemanticSimilarity(resumeText, jobText);
}

/**
 * Calculate the semantic similarity between two texts
 * @param text1 First text (resume)
 * @param text2 Second text (job description)
 * @returns A number between 0-100 representing match percentage
 */
export function calculateSemanticSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // Normalize all text to lowercase for comparison
  const normalizedText1 = text1.toLowerCase();
  const normalizedText2 = text2.toLowerCase();
  
  // Extract important words from both texts (removing common words and short words)
  const text1Words = processTextToWords(normalizedText1);
  const text2Words = processTextToWords(normalizedText2);
  
  // Calculate TF-IDF vectors for both texts
  const allUniqueWords = [...new Set([...Object.keys(text1Words), ...Object.keys(text2Words)])];
  
  // Create TF-IDF vectors
  const vector1 = createTFIDFVector(text1Words, text2Words, allUniqueWords);
  const vector2 = createTFIDFVector(text2Words, text1Words, allUniqueWords);
  
  // Calculate cosine similarity between vectors
  const similarity = calculateCosineSimilarity(vector1, vector2);
  
  // Convert to percentage and round
  const matchPercentage = similarity * 100;
  
  // Cap at 100%
  return Math.min(Math.round(matchPercentage), 100);
}

/**
 * Process text into words with frequency count
 */
function processTextToWords(text: string): Record<string, number> {
  const words = text
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .split(/\s+/)              // Split on whitespace
    .filter(word => word.length > 3 && !commonWords.includes(word)); // Filter out common words and short words
  
  // Count word frequencies
  const wordFrequency: Record<string, number> = {};
  
  for (const word of words) {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  }
  
  return wordFrequency;
}

/**
 * Create TF-IDF vector for a document
 */
function createTFIDFVector(
  docWords: Record<string, number>, 
  otherDocWords: Record<string, number>, 
  allWords: string[]
): number[] {
  return allWords.map(word => {
    // Term frequency in this document
    const tf = docWords[word] || 0;
    
    // Inverse document frequency
    const idf = 1 + (otherDocWords[word] ? 0 : 1); // Simple IDF: 1 if unique to this doc, 2 if in both
    
    return tf * idf;
  });
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate match percentage between pasted resume text and job description
 * This is a convenience function for the testing page
 * @param resumeText Plain text from pasted resume
 * @param jobDescriptionText Plain text from pasted job description
 * @returns A number between 0-100 representing match percentage
 */
export function calculateMatchFromPastedTexts(resumeText: string, jobDescriptionText: string): number {
  if (!resumeText || !jobDescriptionText) return 0;
  
  return calculateSemanticSimilarity(resumeText, jobDescriptionText);
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