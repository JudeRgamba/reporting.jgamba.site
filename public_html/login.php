<?php
session_start();

// If already logged in redirect to dashboard
if (isset($_SESSION['user_id'])) {
  header('Location: /dashboard.php');
  exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_once 'includes/db.php';

  $username = trim($_POST['username'] ?? '');
  $password = trim($_POST['password'] ?? '');

  if (empty($username) || empty($password)) {
    $error = 'Please enter your username and password.';
  } else {
    // Look up user
    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
      // Login successful
      $_SESSION['user_id']  = $user['id'];
      $_SESSION['username'] = $user['username'];

      // Update last login timestamp
      $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
          ->execute([$user['id']]);

      header('Location: /dashboard.php');
      exit;
    } else {
      $error = 'Invalid username or password.';
    }
  }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    <h1>Analytics Dashboard</h1>
    <p>Sign in to view your analytics data</p>

    <?php if ($error): ?>
      <div class="error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="POST" action="/login.php">
      <div class="form-group">
        <label for="username">Username</label>
        <input 
          type="text" 
          id="username" 
          name="username" 
          autocomplete="username"
          value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
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
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>