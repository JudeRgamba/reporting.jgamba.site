<?php
require_once 'includes/auth.php';
?>
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
  <h1>Welcome, <?= htmlspecialchars($_SESSION['username']) ?></h1>
  <a href="/logout.php">Logout</a>
</body>
</html>