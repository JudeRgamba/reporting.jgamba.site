<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  session_start();
  session_destroy();
  header('Content-Type: application/json');
  echo json_encode(['success' => true]);
  exit;
} else {
  http_response_code(405);
  exit;
}