import { error, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { PageLoad } from './$types';

interface ProfileSkill {
  skill_id: number;
  skill_name: string;
  proficiency: number;
}

export const load: PageLoad = async ({ params, parent }) => {
  // Get data from parent layout
  const parentData = await parent();
  const { session, profile } = parentData;

  // Check authentication
  if (!session) {
    throw redirect(302, '/login');
  }

  // Only allow hiring managers to view job seeker profiles
  if (profile?.account_type !== 'hiring_manager') {
    throw error(403, 'Only hiring managers can view job seeker profiles');
  }

  const { id } = params;

  if (!id) {
    throw error(404, 'Profile not found - missing ID');
  }

  try {
    // Fetch job seeker profile
    const { data: jobSeekerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', id)
      .eq('account_type', 'job_seeker')
      .single();

    if (profileError) {
      throw error(404, 'Profile not found');
    }

    if (!jobSeekerProfile) {
      throw error(404, 'Profile not found');
    }

    // Fetch profile skills with related skill data using relationship query
    const { data: profileSkillsData, error: skillsError } = await supabase
      .from('profile_skills')
      .select(`
        proficiency,
        skill_id,
        skills (
          id,
          name
        )
      `)
      .eq('profile_user_id', id);

    if (skillsError) {
      console.error('Error fetching profile skills:', skillsError);
    }

    // Transform skills data to make it easier to use in the component
    const formattedSkills: ProfileSkill[] = [];
    
    if (profileSkillsData) {
      for (const skillRecord of profileSkillsData) {
        // Access skill data safely
        let skillName = 'Unnamed Skill';
        if (skillRecord.skills && typeof skillRecord.skills === 'object') {
          if (Array.isArray(skillRecord.skills) && skillRecord.skills.length > 0) {
            // Handle case where skills might be an array
            skillName = skillRecord.skills[0].name || 'Unnamed Skill';
          } else if ('name' in skillRecord.skills) {
            // Handle case where skills is a single object
            skillName = (skillRecord.skills as any).name || 'Unnamed Skill';
          }
        }
        
        formattedSkills.push({
          skill_id: skillRecord.skill_id,
          skill_name: skillName,
          proficiency: skillRecord.proficiency
        });
      }
    }

    return {
      jobSeekerProfile,
      profileSkills: formattedSkills
    };
  } catch (err: any) {
    console.error('Error in job seeker profile loader:', err);
    if (err.status && err.body) {
      throw err; // Rethrow SvelteKit errors
    }
    throw error(500, 'Failed to load profile data');
  }
}; 