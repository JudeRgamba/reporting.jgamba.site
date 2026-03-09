<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  session_start();
  session_destroy();
  echo json_encode(['success' => true]);
} else {
  http_response_code(405);
}