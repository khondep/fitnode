FitNode

<div align="center">
  <img src="public/logo.png" alt="FitNode logo" width="110" />

Your AI copilot for the job hunt.

Upload your resume once, discover relevant roles, generate tailored resumes, and draft recruiter outreach from one focused workspace.

Live App

</div>

Overview

FitNode helps job seekers spend less time repeating application work and more time preparing for interviews. It combines resume-based job matching with customizable search preferences and AI-assisted application materials.

After uploading a resume, users can review ranked job matches, inspect match scores, tailor their resume for a specific role, and generate a cold email for recruiter outreach. A separate Tailor Chat also lets users paste any job description and create targeted application content on demand.

Features

Resume upload: Upload a PDF or DOCX resume up to 5 MB.

Personalized job discovery: Find relevant openings using the user's resume and search preferences.

Multiple job sources: Surface real listings from Adzuna and USAJobs.

Match scoring: Rank roles by their relevance to the user's experience and preferences.

Search filters: Configure target roles, location, work mode, keywords, and a minimum match score.

AI-tailored resumes: Generate a role-specific resume draft directly from a job match.

Recruiter outreach: Create a tailored cold email for a selected opportunity.

Tailor Chat: Paste a full job description to generate a tailored resume and outreach email.

Personal dashboard: Track total matches, average match score, and generated drafts.

Authentication: Secure sign-up, sign-in, password recovery, and account sessions.

How It Works

flowchart TD
    A[Upload resume] --> B[Set job preferences]
    B --> C[Find and rank matching roles]
    C --> D[Review job matches]
    D --> E[Generate tailored resume]
    D --> F[Draft recruiter email]

Create an account or sign in.

Select target roles, preferred location, work arrangement, and match threshold.

Upload a resume in PDF or DOCX format.

Let FitNode find and score relevant job postings.

Open a match to visit the original listing, tailor the resume, or draft a cold email.

Use Tailor Chat when working with a job description found outside FitNode.

Tech Stack

Area

Technology

Application

Next.js, React

Styling

Tailwind CSS

Authentication and data

Supabase

Job data

Adzuna, USAJobs

Deployment

Vercel

AI generation is handled through server-side application routes so provider credentials and prompts remain outside the browser.

Main Application Areas

Area

Purpose

Dashboard

Resume management and application activity summary

Job Matches

Ranked roles, match scores, original job links, and generated drafts

Tailor Chat

On-demand resume and cold-email generation from a pasted job description

Settings

Roles, keywords, location, work mode, and minimum-score preferences

Onboarding

Initial job-search preference setup

Getting Started

Prerequisites

Node.js 20 or later

npm

A Supabase project

Credentials for the configured job-data and AI services

Installation

git clone <your-repository-url>
cd fitnode
npm install

Create a local environment file from the repository's example, then add the required Supabase, job-source, and AI-provider credentials.

cp .env.example .env.local

Start the development server:

npm run dev

Open http://localhost:3000 in your browser.

Keep service-role keys, job API credentials, and AI-provider secrets in server-only environment variables. Only explicitly public values should use a browser-exposed prefix.

Available Scripts

npm run dev      # Start the local development server
npm run build    # Create a production build
npm run start    # Run the production build
npm run lint     # Check the codebase for lint issues

Project Structure

fitnode/
├── app/          # Pages, layouts, and server-side API routes
├── components/   # Reusable interface components
├── lib/          # Supabase clients and shared application utilities
├── public/       # Static assets
└── README.md

Privacy and Security

Resume files may contain sensitive personal information and should only be accessible to their owner.

Validate file type and size on both the client and server.

Keep privileged Supabase and third-party API credentials server-side.

Apply row-level security to user-owned data.

Avoid logging resume content, generated application materials, or authentication tokens.

Future Improvements

Saved jobs and application-status tracking

Resume version history and draft comparison

Cover-letter generation

Recruiter and company research

Interview-preparation suggestions based on each role

Additional job-board integrations

Live Demo

Try FitNode at fitnode.vercel.app.
