<?php
// includes/db.php
$host = '127.0.0.1';
$user = 'collector';
$pass = 'cse135_Rolls'; // ← update this
$name = 'analytics';

try {
  $pdo = new PDO(
    "mysql:host=$host;dbname=$name;charset=utf8mb4",
    $user,
    $pass,
    [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]
  );
} catch (PDOException $e) {
  die(json_encode(['error' => 'Database connection failed']));
}