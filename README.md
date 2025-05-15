# HiringHub

HiringHub is an AI-powered job matching platform that connects job seekers with hiring managers through intelligent skill matching and seamless communication.

## Overview

HiringHub streamlines the hiring process by analyzing resumes and job descriptions to create meaningful connections between talented professionals and the companies that need them. The platform offers a complete ecosystem for job searching and talent acquisition with built-in messaging, video calls, and application tracking.

## Features

### For Job Seekers
- **AI-Powered Job Matching**: See color-coded match percentages based on your resume and skills
- **Match Sorting**: Sort job listings by match percentage to find the best opportunities
- **One-Click Apply**: Apply to jobs with a single click using your stored resume
- **Profile Management**: Create and maintain a professional profile
- **Resume Upload**: Store your resume for easy applications
- **Real-Time Messaging**: Communicate directly with hiring managers with job context
- **Video/Audio Calls**: Participate in interviews directly through the platform
- **Application Tracking**: Monitor all your job applications in one place

### For Hiring Managers
- **Job Posting**: Create and manage detailed job listings
- **Job Management**: Dedicated dashboard for managing all your job postings
- **Candidate Matching**: AI-powered candidate suggestions based on job requirements
- **Application Management**: View and process applications efficiently
- **Company Profile**: Showcase your company to potential candidates
- **Real-Time Messaging**: Communicate directly with candidates with job context
- **Video/Audio Interviews**: Conduct interviews without leaving the platform
- **Application Statistics**: Track application metrics for each job posting

## Tech Stack

- **Frontend**: SvelteKit, TypeScript
- **Backend/Database**: Supabase
- **Authentication**: Supabase Auth
- **Real-time Features**: Supabase Realtime
- **Storage**: Supabase Storage (for resumes)
- **AI Matching**: Semantic search with TF-IDF and cosine similarity
- **Styling**: Custom CSS with variables for theming

## Recent Updates

### Improved Matching Algorithm
- **Semantic Search**: Enhanced the matching algorithm to use semantic search instead of just keyword matching
- **TF-IDF Vectors**: Implemented TF-IDF vectorization to properly weight important terms in resumes and job descriptions
- **Cosine Similarity**: Added cosine similarity calculation to produce more accurate match percentages

### Enhanced Job Board
- **Color-Coded Match Percentages**: Match percentages now use color coding (green, orange, red) to visually indicate match quality
- **Improved Match Sorting UI**: Added a more intuitive toggle button for sorting jobs by match
- **Consistent Match Display**: Match percentages are now shown for all jobs regardless of sorting preference

### Messaging Improvements
- **Job Context in Messages**: Added job title and company name to chat headers and conversation lists
- **Clickable Job Links**: Job information in chats now links directly to job postings
- **Scrollable Chat Window**: Fixed UI issues to ensure message scrolling works properly
- **Underlined Links**: Enhanced visual cues for clickable elements

### User Experience Enhancements
- **Job Management Link**: Added a dedicated job management link in the navbar for hiring managers
- **Calling Restrictions**: Video/audio calling functionality is now restricted to hiring managers only
- **UI Consistency**: Improved layout and styling consistency across the platform

## Use Cases

### Job Seeker Journey
1. Create an account and profile
2. Upload resume for AI analysis
3. Browse job listings with personalized, color-coded match percentages
4. Sort jobs by match percentage to find the best opportunities
5. Apply to jobs with one click
6. Communicate with hiring managers via messaging with job context
7. Participate in video/audio interviews
8. Track application status

### Hiring Manager Journey
1. Create an account and company profile
2. Post detailed job listings with skill requirements
3. Access job listings via the dedicated Job Management section
4. Review applications sorted by match quality
5. Message promising candidates with job context automatically included
6. Initiate video/audio interviews with candidates
7. Manage hiring pipeline with status tracking
8. Access application statistics

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm or pnpm
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/HiringHub.git
cd HiringHub
```

2. Install dependencies:
```bash
npm install
# or with pnpm
pnpm install
```

3. Configure environment variables:
Create a `.env` file with the following variables:
```
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
# or
pnpm dev
```

The application should now be running at http://localhost:5173/

## Database Setup

HiringHub relies on Supabase for its backend. You'll need to set up the following tables:
- profiles
- jobs
- job_skills
- skills
- applications
- messages
- chats

The schema structure can be inferred from the application code or contact the repository maintainers for a SQL script to set up the database.

## Building for Production

```bash
npm run build
# or
pnpm build
```

You can preview the production build with `npm run preview`.

## Dependencies

- SvelteKit
- TypeScript
- Supabase JS Client
- Other dependencies are listed in package.json

## Additional Information

- The matching algorithm is located in `src/lib/utils/matchingAlgorithm.ts`
- Real-time messaging and call functionality uses Supabase Realtime channels
- Application state is managed through Svelte stores
- The UI is responsive and works on mobile devices

## Future Considerations

The HiringHub platform has several exciting enhancements planned for future development:

### Email Functionality
- **Automated Notifications**: Email alerts for new messages, job applications, and interview requests
- **Digest Emails**: Weekly job recommendations based on skills and preferences
- **Transactional Emails**: Application status updates and interview confirmations
- **Marketing Communications**: Optional newsletters with career tips and industry insights

### Enhanced Matching with Semantic Search and RAG
- **Semantic Resume Analysis**: Moving beyond keyword matching to understand the context and relevance of skills and experiences
- **Retrieval Augmented Generation (RAG)**: Leveraging large language models to better interpret both job descriptions and resumes
- **Skills Taxonomy Integration**: Building a comprehensive database of related skills and competencies
- **Soft Skills Assessment**: Analyzing communication styles and cultural fit indicators
- **Career Path Prediction**: Suggesting jobs that align with career progression patterns

### Agentic AI for Messaging and Interviews
- **Interview Preparation Assistant**: AI-powered preparation tools offering customized advice based on job requirements
- **Message Suggestions**: Contextual recommendations for effective communication
- **Automated Scheduling**: AI agents coordinating interview times based on availability
- **Conversation Summarization**: Providing concise summaries of lengthy message threads
- **Interview Insights**: Post-interview analysis highlighting strengths and areas for improvement
- **Follow-up Recommendations**: Suggesting appropriate timing and content for follow-up communications

### Platform Enhancements
- **Mobile Application**: Native mobile apps for iOS and Android
- **Advanced Analytics Dashboard**: Comprehensive insights for both job seekers and hiring managers
- **Integration Ecosystem**: Connections with popular ATS, CRM, and calendar systems
- **Multilingual Support**: Expanding to support multiple languages
- **Accessibility Improvements**: Enhanced compliance with WCAG guidelines

These future enhancements aim to create an even more seamless, intelligent, and effective hiring ecosystem that benefits both job seekers and hiring managers.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
