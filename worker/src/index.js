export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    
    try {
      // Test endpoint
      if (url.pathname === '/test') {
        const users = await env.DB.prepare('SELECT id, name, email, role FROM users').all();
        return new Response(JSON.stringify({ users: users.results }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Login endpoint
      if (url.pathname === '/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        
        if (!email || !password) {
          return new Response(JSON.stringify({ error: 'Missing email or password' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const user = await env.DB.prepare(
          'SELECT * FROM users WHERE email = ?'
        ).bind(email).first();

        // Simple password check (SHA-256 hash)
        const hashedPassword = await hashPassword(password);
        
        if (!user || user.password !== hashedPassword) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const { password: _, ...userWithoutPassword } = user;
        const token = 'dummy-token-' + Date.now();

        return new Response(JSON.stringify({ user: userWithoutPassword, token }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}