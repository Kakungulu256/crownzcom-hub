import { hashPassword, verifyPassword, generateJWT, verifyJWT } from './utils.js';
import { getCORSHeaders } from './cors.js';

export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    switch (path) {
      case '/auth/register':
        return await handleRegister(request, env);
      case '/auth/login':
        return await handleLogin(request, env);
      case '/auth/me':
        return await handleMe(request, env);
      case '/auth/logout':
        return await handleLogout(request, env);
      default:
        return new Response('Not Found', { 
          status: 404,
          headers: getCORSHeaders()
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }
}

async function handleRegister(request, env) {
  const { name, email, password } = await request.json();
  
  if (!name || !email || !password) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }

  const hashedPassword = await hashPassword(password);
  
  try {
    await env.DB.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).bind(name, email, hashedPassword, 'member').run();

    const user = await env.DB.prepare(
      'SELECT id, name, email, role FROM users WHERE email = ?'
    ).bind(email).first();

    const token = await generateJWT({ userId: user.id, email: user.email, role: user.role });

    return new Response(JSON.stringify({ user, token }), {
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return new Response(JSON.stringify({ error: 'Email already exists' }), {
        status: 409,
        headers: { 
          'Content-Type': 'application/json', 
          ...getCORSHeaders() 
        }
      });
    }
    throw error;
  }
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();
  
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Missing email or password' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user || !(await verifyPassword(password, user.password))) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }

  const token = await generateJWT({ userId: user.id, email: user.email, role: user.role });
  const { password: _, ...userWithoutPassword } = user;

  return new Response(JSON.stringify({ user: userWithoutPassword, token }), {
    headers: { 
      'Content-Type': 'application/json', 
      ...getCORSHeaders() 
    }
  });
}

async function handleMe(request, env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'No token provided' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }

  const user = await env.DB.prepare(
    'SELECT id, name, email, role FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json', 
        ...getCORSHeaders() 
      }
    });
  }

  return new Response(JSON.stringify({ user }), {
    headers: { 
      'Content-Type': 'application/json', 
      ...getCORSHeaders() 
    }
  });
}

async function handleLogout(request, env) {
  return new Response(JSON.stringify({ message: 'Logged out successfully' }), {
    headers: { 
      'Content-Type': 'application/json', 
      ...getCORSHeaders() 
    }
  });
}