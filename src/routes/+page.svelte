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

<div class="container" role="document">
	<header class="site-header">
		<div class="project-title">
			<h1 class="title-text">HiringHub</h1>
			<p class="title-tagline">Where Talent Meets Demand</p>
		</div>
	</header>
	
	<main id="main-content">
		<section class="hero" aria-labelledby="hero-heading">
			<h2 id="hero-heading" class="hero-heading">Find Your Perfect Match: AI-Powered Job Matching That Works</h2>
			<p class="subheadline">
				Connect with opportunities that align with your skills and experience, powered by intelligent
				matching technology.
			</p>
			<div class="cta-buttons">
				<a href="/register" class="cta-seeker button-primary" aria-label="Upload your resume to get started as a job seeker">Upload Your Resume</a>
				<a href="/register" class="cta-hiring button-secondary" aria-label="Register to find top talent as an employer">Find Top Talent</a>
			</div>
		</section>

		<section class="supporting-statement text-center mb-5" aria-label="About our matching algorithm">
			<p class="italic text-lg">
				Our AI matching algorithm analyzes skills, experience, and qualifications to create meaningful
				connections between talented professionals and the companies that need them.
			</p>
		</section>

		<section class="benefits" aria-labelledby="benefits-heading">
			<h2 id="benefits-heading" class="text-center mb-4">Key Benefits</h2>
			<div class="grid grid-cols-2">
				<div class="benefit-group">
					<h3 id="seeker-benefits">For Job Seekers</h3>
					<ul aria-labelledby="seeker-benefits">
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
					<h3 id="hiring-benefits">For Hiring Managers</h3>
					<ul aria-labelledby="hiring-benefits">
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

		<section class="how-it-works" aria-labelledby="how-heading">
			<h2 id="how-heading" class="text-center mb-4">How It Works</h2>
			<div class="grid grid-cols-2">
				<div class="how-group">
					<h3 id="seeker-steps">For Job Seekers</h3>
					<ol aria-labelledby="seeker-steps">
						<li>Upload Your Resume - Our AI analyzes your skills and experience</li>
						<li>Review Your Profile - Verify and enhance your professional information</li>
						<li>Explore Matches - Discover opportunities aligned with your qualifications</li>
						<li>Apply With Confidence - Focus on positions where you're a strong match</li>
					</ol>
				</div>
				<div class="how-group">
					<h3 id="hiring-steps">For Hiring Managers</h3>
					<ol aria-labelledby="hiring-steps">
						<li>Post Your Job - Detail the skills and qualifications you need</li>
						<li>Review Matched Candidates - See ranked applicants based on match quality</li>
						<li>Engage With Top Prospects - Easily connect with promising candidates</li>
						<li>Build Your Team - Make confident hiring decisions based on objective matching</li>
					</ol>
				</div>
			</div>
		</section>

		<section class="testimonials" aria-labelledby="testimonials-heading">
			<h2 id="testimonials-heading" class="text-center mb-4">Testimonials</h2>
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
	</main>

	<footer class="site-footer final-cta text-center mt-5">
		<h2 class="text-white">Join the Smarter Way to Connect</h2>
		<p class="text-white mb-4">
			Create your free account today and experience the power of AI-driven job matching.
		</p>
		<a href="/register" class="cta-final button-outline" aria-label="Create your free account">Create Free Account</a>
	</footer>
</div>

<style>
  /* Home page specific styles */
  .project-title {
    text-align: center;
    padding: var(--spacing-md) 0 var(--spacing-xs);
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .title-text {
    font-size: 3rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: var(--spacing-xs);
    letter-spacing: -0.02em;
  }

  .title-tagline {
    font-size: 1.25rem;
    color: var(--text-muted-color);
    font-weight: 500;
    margin-bottom: var(--spacing-xs);
  }
  
  .hero {
    text-align: center;
    padding: var(--spacing-md) 0 var(--spacing-xl);
    margin-bottom: var(--spacing-lg);
  }

  .hero-heading {
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
    /* Accessibility improvements */
    min-height: 44px;
    min-width: 44px;
  }
  
  .button-primary:hover {
    background-color: var(--primary-color-dark);
    text-decoration: none;
  }
  
  .button-primary:focus {
    outline: 3px solid var(--focus-ring-color, #4A90E2);
    outline-offset: 2px;
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
    /* Accessibility improvements */
    min-height: 44px;
    min-width: 44px;
  }
  
  .button-secondary:hover {
    background-color: var(--primary-color-light);
    text-decoration: none;
  }
  
  .button-secondary:focus {
    outline: 3px solid var(--focus-ring-color, #4A90E2);
    outline-offset: 2px;
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
    /* Accessibility improvements */
    min-height: 44px;
    min-width: 44px;
  }
  
  .button-outline:hover {
    background-color: rgba(255, 255, 255, 0.3);
    text-decoration: none;
  }
  
  .button-outline:focus {
    outline: 3px solid white;
    outline-offset: 2px;
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

    .hero-heading {
      font-size: 2rem;
    }

    .benefit-group, .how-group {
      margin-bottom: var(--spacing-md);
    }
    
    /* Fix grid on small screens */
    .grid.grid-cols-2 {
      display: block;
    }
    
    .testimonial-card {
      margin-bottom: var(--spacing-md);
    }
  }
  
  /* Skip link for keyboard users */
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--primary-color);
    color: white;
    padding: 8px;
    z-index: 100;
    transition: top 0.1s ease-in;
  }
  
  .skip-link:focus {
    top: 0;
  }
</style>

<svelte:head>
  <!-- Add relevant meta tags for accessibility -->
  <title>HiringHub - Where Talent Meets Demand</title>
  <meta name="description" content="Connect with opportunities that align with your skills and experience, powered by intelligent matching technology.">
  <meta name="language" content="en">
</svelte:head>

<div class="skip-to-content">
  <a href="#main-content" class="skip-link">Skip to main content</a>
</div>
