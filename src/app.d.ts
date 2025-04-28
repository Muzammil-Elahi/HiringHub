// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: import('@supabase/supabase-js').SupabaseClient;
			session: import('@supabase/supabase-js').Session | null;
			profile: any | null;
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
