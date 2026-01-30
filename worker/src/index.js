import bcrypt from 'bcryptjs';

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

      // Register endpoint
      if (url.pathname === '/auth/register' && request.method === 'POST') {
        const { name, email, password } = await request.json();
        
        if (!name || !email || !password) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Check if user exists
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) {
          return new Response(JSON.stringify({ error: 'Email already exists' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await env.DB.prepare(
          'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
        ).bind(name, email, hashedPassword, 'member').run();

        const user = await env.DB.prepare(
          'SELECT id, name, email, role FROM users WHERE email = ?'
        ).bind(email).first();

        const token = await generateToken(user);

        return new Response(JSON.stringify({ user, token }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Login endpoint
      if (url.pathname === '/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        
        if (!email || !password) {
          return new Response(JSON.stringify({ error: 'Missing email or password' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const user = await env.DB.prepare(
          'SELECT * FROM users WHERE email = ?'
        ).bind(email).first();

        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Verify password with bcrypt
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { password: _, ...userWithoutPassword } = user;
        const token = await generateToken(userWithoutPassword);

        return new Response(JSON.stringify({ user: userWithoutPassword, token }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get current user endpoint
      if (url.pathname === '/auth/me' && request.method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'No token provided' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const token = authHeader.replace('Bearer ', '');
        const payload = await verifyToken(token);
        
        if (!payload) {
          return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const user = await env.DB.prepare(
          'SELECT id, name, email, role FROM users WHERE id = ?'
        ).bind(payload.userId).first();

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({ user }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

// Simple JWT-like token generation
async function generateToken(user) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  }));
  const signature = await sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

async function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSignature = await sign(`${header}.${payload}`);
    
    if (signature !== expectedSignature) return null;
    
    const decoded = JSON.parse(atob(payload));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    
    return decoded;
  } catch {
    return null;
  }
}

async function sign(data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('your-secret-key-change-in-production'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}