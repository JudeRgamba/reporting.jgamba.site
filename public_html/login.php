<?php
session_start();

if (isset($_SESSION['user_id'])) {
  header('Location: /dashboard.php');
  exit;
}

// Handle JSON POST from fetch()
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  header('Content-Type: application/json');
  require_once 'includes/db.php';

  $input = json_decode(file_get_contents('php://input'), true);
  $email    = trim($input['email'] ?? '');
  $password = trim($input['password'] ?? '');

  if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email and password required']);
    exit;
  }

  $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
  $stmt->execute([$email]);
  $user = $stmt->fetch();

  if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
    exit;
  }

  // Success
  session_regenerate_id(true); // prevent session fixation
  $_SESSION['user_id']  = $user['id'];
  $_SESSION['username'] = $user['username'];
  $_SESSION['display_name'] = $user['display_name'] ?? $user['username'];
  $_SESSION['role'] = $user['role'];

  $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
      ->execute([$user['id']]);

  echo json_encode(['success' => true]);
  exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/x-icon" href="favicon.ico">
<title>Login — Analytics Dashboard</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    }

    .login-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    }

    .login-card h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #f1f5f9;
    }

    .login-card p {
    color: #94a3b8;
    margin-bottom: 32px;
    font-size: 14px;
    }

    .form-group {
    margin-bottom: 20px;
    }

    label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    }

    input {
    width: 100%;
    padding: 10px 14px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #f1f5f9;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
    }

    input:focus {
    border-color: #3b82f6;
    }

    .error {
    background: #450a0a;
    border: 1px solid #991b1b;
    color: #fca5a5;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 20px;
    }

    button {
    width: 100%;
    padding: 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    }

    button:hover {
    background: #2563eb;
    }
</style>
</head>
<body>
<div class="login-card">
    <h1>Hole in One Analytics</h1>
    <p>Sign in to view your website's analytics</p>

    <form id="login-form">
    <div class="form-group">
        <label for="email">Email</label>
        <input 
        type="email" 
        id="email" 
        name="email" 
        autocomplete="email"
        required
        >
    </div>
    <div class="form-group">
        <label for="password">Password</label>
        <input 
        type="password" 
        id="password" 
        name="password"
        autocomplete="current-password"
        required
        >
    </div>
    <div id="error-message" class="error" hidden></div>
    <button type="submit">Sign In</button>
    </form>
</div>
<script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');

    try {
        const res = await fetch('/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
        window.location.href = '/dashboard.php';
        } else {
        errorDiv.textContent = data.error || 'Login failed';
        errorDiv.removeAttribute('hidden');
        }
    } catch (err) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.removeAttribute('hidden');
    }
    });
</script>
</body>
</html>