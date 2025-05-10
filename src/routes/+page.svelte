<script lang="ts">
	// Import the navigation store function - REMOVE LATER
	// import { navigateTo } from '../lib/stores/navigationStore'; // Incorrect path for SvelteKit
	import { goto } from '$app/navigation'; // SvelteKit navigation
	import { page } from '$app/stores'; // Access route info if needed

	// Remove the props for navigation callbacks
	// export let onNavigateToSeeker: () => void;
	// export let onNavigateToHiring: () => void;

	// You can keep other script logic if needed
</script>

<div class="container">
	<header class="hero">
		<h1>Find Your Perfect Match: AI-Powered Job Matching That Works</h1>
		<p class="subheadline">
			Connect with opportunities that align with your skills and experience, powered by intelligent
			matching technology.
		</p>
		<div class="cta-buttons">
			<!-- Update buttons to use standard links -->
			<a href="/register" class="cta-seeker button-primary">Upload Your Resume</a>
			<a href="/register" class="cta-hiring button-secondary">Find Top Talent</a>
		</div>
	</header>

	<section class="supporting-statement text-center mb-5">
		<p class="italic text-lg">
			Our AI matching algorithm analyzes skills, experience, and qualifications to create meaningful
			connections between talented professionals and the companies that need them.
		</p>
	</section>

	<section class="benefits">
		<h2 class="text-center mb-4">Key Benefits</h2>
		<div class="grid grid-cols-2">
			<!-- Grid automatically stacks on mobile due to app.css -->
			<div class="benefit-group">
				<h3>For Job Seekers</h3>
				<ul>
					<li>
						<strong>Discover Your Perfect Fit:</strong> Stop scrolling through endless job listings.
						Our AI technology matches your skills and experience to opportunities where you'll
						truly excel.
					</li>
					<li>
						<strong>Save Time, Apply Smarter:</strong> Focus on opportunities that match your
						profile. See your match percentage and understand exactly why you're a good fit.
					</li>
					<li>
						<strong>Career Growth Insights:</strong> Identify skill gaps and growth opportunities
						based on the positions you're interested in.
					</li>
				</ul>
			</div>
			<div class="benefit-group">
				<h3>For Hiring Managers</h3>
				<ul>
					<li>
						<strong>Quality Over Quantity:</strong> Stop wading through hundreds of resumes. We'll
						connect you with candidates who truly match your requirements.
					</li>
					<li>
						<strong>Efficient Hiring Pipeline:</strong> Review candidates ranked by match
						percentage and quickly identify those with the specific skills and experience you
						need.
					</li>
					<li>
						<strong>Find Hidden Talent:</strong> Discover qualified candidates who might be
						overlooked in traditional hiring processes.
					</li>
				</ul>
			</div>
		</div>
	</section>

	<section class="how-it-works">
		<h2 class="text-center mb-4">How It Works</h2>
		<div class="grid grid-cols-2">
			<div class="how-group">
				<h3>For Job Seekers</h3>
				<ol>
					<li>Upload Your Resume - Our AI analyzes your skills and experience</li>
					<li>Review Your Profile - Verify and enhance your professional information</li>
					<li>Explore Matches - Discover opportunities aligned with your qualifications</li>
					<li>Apply With Confidence - Focus on positions where you're a strong match</li>
				</ol>
			</div>
			<div class="how-group">
				<h3>For Hiring Managers</h3>
				<ol>
					<li>Post Your Job - Detail the skills and qualifications you need</li>
					<li>Review Matched Candidates - See ranked applicants based on match quality</li>
					<li>Engage With Top Prospects - Easily connect with promising candidates</li>
					<li>Build Your Team - Make confident hiring decisions based on objective matching</li>
				</ol>
			</div>
		</div>
	</section>

	<section class="testimonials">
		<h2 class="text-center mb-4">Testimonials</h2>
		<!-- Using grid for testimonials for potential future multi-column layout -->
		<div class="grid grid-cols-2">
			<div class="testimonial-card">
				<blockquote>
					"This platform completely transformed our hiring process. We found qualified candidates
					faster and with much less effort than traditional methods."
				</blockquote>
				<cite>— Alex Johnson, HR Director</cite>
			</div>
			<div class="testimonial-card">
				<blockquote>
					"I was skeptical about AI matching at first, but my new position is genuinely perfect
					for my skill set. The platform matched me with a role I might never have found
					otherwise."
				</blockquote>
				<cite>— Sarah Williams, Software Developer</cite>
			</div>
		</div>
	</section>

	<footer class="final-cta text-center mt-5">
		<!-- Reusing hero styles but could be customized -->
		<h2 class="text-white">Join the Smarter Way to Connect</h2>
		<p class="text-white mb-4">
			Create your free account today and experience the power of AI-driven job matching.
		</p>
		<!-- Update final CTA button as well -->
		<a href="/register" class="cta-final button-outline">Create Free Account</a>
	</footer>
</div>

<style>
  /* Home page specific styles */
  .hero {
    text-align: center;
    padding: var(--spacing-xl) 0;
    margin-bottom: var(--spacing-lg);
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: var(--spacing-md);
    color: var(--primary-color);
  }

  .subheadline {
    font-size: var(--font-size-lg);
    color: var(--text-muted-color);
    margin-bottom: var(--spacing-lg);
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .cta-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  /* Button styles that should be consistent with the rest of the site */
  .button-primary {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s ease;
  }
  
  .button-primary:hover {
    background-color: var(--primary-color-dark);
    text-decoration: none;
  }
  
  .button-secondary {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--background-color, white);
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  
  .button-secondary:hover {
    background-color: var(--primary-color-light);
    text-decoration: none;
  }

  .button-outline {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: transparent;
    color: white;
    border: 2px solid white;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s ease;
  }
  
  .button-outline:hover {
    background-color: rgba(255, 255, 255, 0.1);
    text-decoration: none;
  }

  /* Text utilities */
  .italic {
    font-style: italic;
  }

  .text-lg {
    font-size: var(--font-size-lg);
  }

  .text-white {
    color: white;
  }

  /* Section styles */
  .benefits, .how-it-works {
    margin-bottom: var(--spacing-xl);
  }

  .benefit-group, .how-group {
    padding: var(--spacing-md);
  }

  .benefit-group h3, .how-group h3 {
    margin-bottom: var(--spacing-md);
    color: var(--primary-color);
  }

  .benefit-group ul, .how-group ol {
    padding-left: var(--spacing-lg);
  }

  .benefit-group li, .how-group li {
    margin-bottom: var(--spacing-md);
  }

  /* Testimonials */
  .testimonials {
    margin-bottom: var(--spacing-xl);
  }

  .testimonial-card {
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
  }

  .testimonial-card blockquote {
    font-style: italic;
    margin-bottom: var(--spacing-md);
  }

  .testimonial-card cite {
    font-weight: 500;
    color: var(--primary-color);
  }

  /* Final CTA section */
  .final-cta {
    padding: var(--spacing-xl) var(--spacing-lg);
    background-color: var(--primary-color);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-xl);
  }

  .final-cta h2 {
    color: white;
    margin-bottom: var(--spacing-md);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .cta-buttons {
      flex-direction: column;
      align-items: center;
    }

    h1 {
      font-size: 2rem;
    }

    .benefit-group, .how-group {
      margin-bottom: var(--spacing-md);
    }
  }
</style>
