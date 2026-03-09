<?php
require_once 'includes/auth.php';
?>
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
  <h1>Welcome, <?= htmlspecialchars($_SESSION['username']) ?></h1>
  <button id="logout-btn">Sign Out</button>

  <script>
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await fetch('/logout.php', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/login.php';
    });
  </script>
</body>
</html>